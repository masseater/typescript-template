// oxlint-disable-next-line import/no-nodejs-modules
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import { tmpdir } from "node:os";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";

import type { HttpServer } from "vite-plus";
import { createServer } from "vite-plus";
import { test as baseTest, describe, expect } from "vite-plus/test";
import type { TestAPI } from "vite-plus/test";

import type { Application as App } from "@template/config";
import { applications as apps } from "@template/config";

import { devBoundary } from "./index.ts";

interface DevServer {
  readonly origin: string;
  readonly root: string;
}

type ServerContext = Readonly<{ server: DevServer }>;

const okStatus = 200;
const forbiddenStatus = 403;
const hexRadix = 16;

function otherApps(app: App): App[] {
  return apps.filter((name) => name !== app);
}

async function createRepository(root: string, app: App): Promise<string> {
  const appDirectory = path.join(root, "apps", app);
  const folders = [
    ...apps.map((name) => `apps/${name}/src`),
    "libs/db/src",
    "libs/ui",
    ".local",
    "tools",
  ];
  await Promise.all(
    folders.map(async (folder) => {
      await mkdir(path.join(root, folder), { recursive: true });
    }),
  );
  await Promise.all([
    writeFile(
      path.join(appDirectory, "index.html"),
      '<html><body>App<script type="module" src="/src/entry.js"></script></body></html>',
    ),
    writeFile(path.join(appDirectory, "src/entry.js"), `export const label = "${app}-module";`),
    ...otherApps(app).map(async (other) =>
      writeFile(
        path.join(root, `apps/${other}/src/private.js`),
        'export const label = "private-application-module";',
      ),
    ),
    writeFile(
      path.join(root, "libs/db/src/remote-cli.ts"),
      'export const label = "private-remote-database";',
    ),
    writeFile(
      path.join(root, "libs/db/src/admin.ts"),
      'export const label = "private-admin-database";',
    ),
    writeFile(path.join(root, ".local/runtime.json"), '{"password":"test-secret-marker"}'),
    writeFile(path.join(appDirectory, ".dev.vars"), 'AUTH_SECRET="test-secret-marker-dev-vars"'),
    writeFile(
      path.join(root, "tools/private.js"),
      'export const label = "private-internal-module";',
    ),
    symlink(path.join(root, ".local/runtime.json"), path.join(appDirectory, "src/alias.json")),
  ]);
  return appDirectory;
}

function listeningPort(address: Readonly<ReturnType<HttpServer["address"]>> | undefined): number {
  if (address === undefined || address === null || typeof address === "string") {
    throw new Error("TEST_SERVER_ADDRESS_REQUIRED");
  }
  return address.port;
}

function boundaryTest(app: App): TestAPI<{ server: DevServer }> {
  return baseTest.extend<{ server: DevServer }>({
    server: [
      async ({}: object, provide): Promise<void> => {
        const directory = await mkdtemp(path.join(tmpdir(), `${app}-dev-boundary-`));
        const root = await realpath(directory);
        const server = await createServer({
          configFile: false,
          logLevel: "silent",
          plugins: [devBoundary(app, root)],
          root: await createRepository(root, app),
          server: { host: "127.0.0.1", port: 0, strictPort: true },
        });
        try {
          await server.listen();
          const port = listeningPort(server.httpServer?.address());
          await provide({ origin: `http://127.0.0.1:${port}`, root });
        } finally {
          await server.close();
          await rm(directory, { force: true, recursive: true });
        }
      },
      { scope: "file" },
    ],
  });
}

async function statusOf(url: string): Promise<number> {
  const response = await fetch(url);
  return response.status;
}

function privateFiles(app: App): string[] {
  return [
    ".local/runtime.json",
    `apps/${app}/.dev.vars`,
    "libs/db/src/remote-cli.ts",
    "tools/private.js",
    ...otherApps(app).map((name) => `apps/${name}/src/private.js`),
  ].flatMap((file) => ["", "?raw", "?import"].map((suffix) => `${file}${suffix}`));
}

function privateModules(app: App): string[] {
  return [
    "/.dev.vars",
    "/src/alias.json",
    "/@id/@template/db/remote",
    ...(app === "admin" ? [] : ["/@id/@template/db/admin"]),
    ...otherApps(app).flatMap((other) => [
      `/@id/@template/${other}`,
      `/@fs/{root}/apps/%${(other.codePointAt(0) ?? 0).toString(hexRadix)}${other.slice(1)}/src/private.js?raw`,
    ]),
  ];
}

const boundaryTests: Readonly<Record<App, TestAPI<{ server: DevServer }>>> = {
  admin: boundaryTest("admin"),
  user: boundaryTest("user"),
  wiki: boundaryTest("wiki"),
};

describe.each(apps)("%s development boundary", (app) => {
  const test = boundaryTests[app];
  const adminDatabaseStatus = app === "admin" ? okStatus : forbiddenStatus;

  test("serves its own application", async ({ server }: ServerContext) => {
    expect.hasAssertions();
    await expect(statusOf(`${server.origin}/`)).resolves.toBe(okStatus);
    const entry = await fetch(`${server.origin}/src/entry.js`);
    await expect(entry.text()).resolves.toContain(`${app}-module`);
    await expect(statusOf(`${server.origin}/@vite/client`)).resolves.toBe(okStatus);
  });

  test.for(privateFiles(app))(
    "rejects private file %s",
    async (file, { server }: ServerContext) => {
      expect.hasAssertions();
      const response = await fetch(`${server.origin}/@fs/${server.root}/${file}`);
      expect(response.status).toBe(forbiddenStatus);
      await expect(response.text()).resolves.not.toMatch(/test-secret-marker|private-/u);
    },
  );

  test("serves the administrator database module only to admin", async ({
    server,
  }: ServerContext) => {
    expect.hasAssertions();
    await expect(
      statusOf(`${server.origin}/@fs/${server.root}/libs/db/src/admin.ts?raw`),
    ).resolves.toBe(adminDatabaseStatus);
  });

  test.for(privateModules(app))(
    "rejects private module %s",
    async (file, { server }: ServerContext) => {
      expect.hasAssertions();
      const url = `${server.origin}${file.replace("{root}", server.root)}`;
      await expect(statusOf(url)).resolves.toBe(forbiddenStatus);
    },
  );
});
