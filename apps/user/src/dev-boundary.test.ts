import { test as baseTest, describe, expect } from "vite-plus/test";
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { createServer } from "vite-plus";
import path from "node:path";
import { tmpdir } from "node:os";
import { userDevBoundary } from "#dev-boundary";

const okStatus = 200;
const forbiddenStatus = 403;

interface DevServer {
  readonly origin: string;
  readonly root: string;
}

async function createRepository(root: string): Promise<string> {
  const app = path.join(root, "apps/user");
  await Promise.all(
    ["apps/user/src", "apps/admin/src", "libs/db/src", "libs/ui", ".local", "tools"].map(
      async (folder) => {
        await mkdir(path.join(root, folder), { recursive: true });
      },
    ),
  );
  await Promise.all([
    writeFile(
      path.join(app, "index.html"),
      '<html><body>User<script type="module" src="/src/entry.js"></script></body></html>',
    ),
    writeFile(path.join(app, "src/entry.js"), 'export const label = "user-module";'),
    writeFile(
      path.join(root, "apps/admin/src/private.js"),
      'export const label = "private-admin-module";',
    ),
    writeFile(
      path.join(root, "libs/db/src/admin.ts"),
      'export const label = "private-admin-database";',
    ),
    writeFile(path.join(root, ".local/runtime.json"), '{"password":"test-secret-marker"}'),
    writeFile(
      path.join(root, "tools/private.js"),
      'export const label = "private-internal-module";',
    ),
    symlink(path.join(root, ".local/runtime.json"), path.join(app, "src/alias.json")),
  ]);
  return app;
}

function listeningPort(address: Readonly<AddressInfo> | string | null | undefined): number {
  if (address === undefined || address === null || typeof address === "string") {
    throw new Error("TEST_SERVER_ADDRESS_REQUIRED");
  }
  return address.port;
}

const test = baseTest.extend<{ server: DevServer }>({
  server: [
    async ({}, provide): Promise<void> => {
      const directory = await mkdtemp(path.join(tmpdir(), "user-dev-boundary-"));
      const root = await realpath(directory);
      const server = await createServer({
        configFile: false,
        logLevel: "silent",
        plugins: [userDevBoundary(root)],
        root: await createRepository(root),
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

async function statusOf(url: string): Promise<number> {
  const response = await fetch(url);
  return response.status;
}

describe("user development boundary", () => {
  test("serves the user application", async ({ server }) => {
    expect.hasAssertions();
    await expect(statusOf(`${server.origin}/`)).resolves.toBe(okStatus);
    const entry = await fetch(`${server.origin}/src/entry.js`);
    await expect(entry.text()).resolves.toContain("user-module");
    await expect(statusOf(`${server.origin}/@vite/client`)).resolves.toBe(okStatus);
  });

  test.for(
    [
      ".local/runtime.json",
      "apps/admin/src/private.js",
      "libs/db/src/admin.ts",
      "tools/private.js",
    ].flatMap((file) => ["", "?raw", "?import"].map((suffix) => `${file}${suffix}`)),
  )("rejects private file %s", async (file, { server }) => {
    expect.hasAssertions();
    const response = await fetch(`${server.origin}/@fs/${server.root}/${file}`);
    expect(response.status).toBe(forbiddenStatus);
    await expect(response.text()).resolves.not.toMatch(/test-secret-marker|private-admin/u);
  });

  test.for([
    "/src/alias.json",
    "/@id/@template/admin",
    "/@id/@template/db/admin",
    "/@fs/{root}/apps/%61dmin/src/private.js?raw",
  ])("rejects private module %s", async (file, { server }) => {
    expect.hasAssertions();
    const url = `${server.origin}${file.replace("{root}", server.root)}`;
    await expect(statusOf(url)).resolves.toBe(forbiddenStatus);
  });
});
