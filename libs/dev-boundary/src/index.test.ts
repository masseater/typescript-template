import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "vite-plus";
import { expect, test } from "vitest";
import { devBoundary } from "./index.ts";

const apps = ["user", "admin", "wiki"] as const;

test.for(apps)(
  "%s Vite serves its app but rejects secret files and other applications",
  async (app) => {
    const directory = await mkdtemp(path.join(tmpdir(), `${app}-dev-boundary-`));
    const root = await realpath(directory);
    const appDirectory = path.join(root, "apps", app);
    for (const folder of [
      ...apps.map((name) => `apps/${name}/src`),
      "libs/db/src",
      "libs/ui",
      ".local",
      "tools",
    ])
      await mkdir(path.join(root, folder), { recursive: true });
    await writeFile(
      path.join(appDirectory, "index.html"),
      '<html><body>App<script type="module" src="/src/entry.js"></script></body></html>',
    );
    await writeFile(
      path.join(appDirectory, "src/entry.js"),
      `export const label = "${app}-module";`,
    );
    for (const other of apps.filter((name) => name !== app))
      await writeFile(
        path.join(root, `apps/${other}/src/private.js`),
        'export const label = "private-application-module";',
      );
    await writeFile(
      path.join(root, "libs/db/src/remote-cli.ts"),
      'export const label = "private-remote-database";',
    );
    await writeFile(
      path.join(root, "libs/db/src/admin.ts"),
      'export const label = "private-admin-database";',
    );
    await writeFile(path.join(root, ".local/runtime.json"), '{"password":"test-secret-marker"}');
    await writeFile(
      path.join(appDirectory, ".dev.vars"),
      'AUTH_SECRET="test-secret-marker-dev-vars"',
    );
    await writeFile(
      path.join(root, "tools/private.js"),
      'export const label = "private-internal-module";',
    );
    await symlink(
      path.join(root, ".local/runtime.json"),
      path.join(appDirectory, "src/alias.json"),
    );
    const server = await createServer({
      configFile: false,
      root: appDirectory,
      plugins: [devBoundary(app, root)],
      server: { host: "127.0.0.1", port: 0, strictPort: true },
      logLevel: "silent",
    });
    try {
      await server.listen();
      const address = server.httpServer?.address();
      if (!address || typeof address === "string") throw new Error("TEST_SERVER_ADDRESS_REQUIRED");
      const origin = `http://127.0.0.1:${address.port}`;
      expect((await fetch(`${origin}/`)).status).toBe(200);
      expect(await (await fetch(`${origin}/src/entry.js`)).text()).toContain(`${app}-module`);
      expect((await fetch(`${origin}/@vite/client`)).status).toBe(200);
      for (const file of [
        ".local/runtime.json",
        `apps/${app}/.dev.vars`,
        "libs/db/src/remote-cli.ts",
        "tools/private.js",
        ...apps.filter((name) => name !== app).map((name) => `apps/${name}/src/private.js`),
      ]) {
        for (const suffix of ["", "?raw", "?import"]) {
          const response = await fetch(`${origin}/@fs/${root}/${file}${suffix}`);
          expect(response.status).toBe(403);
          expect(await response.text()).not.toMatch(/test-secret-marker|private-/);
        }
      }
      expect((await fetch(`${origin}/@fs/${root}/libs/db/src/admin.ts?raw`)).status).toBe(
        app === "admin" ? 200 : 403,
      );
      for (const privileged of app === "admin" ? [] : ["/@id/@template/db/admin"])
        expect((await fetch(`${origin}${privileged}`)).status).toBe(403);
      expect((await fetch(`${origin}/.dev.vars`)).status).toBe(403);
      expect((await fetch(`${origin}/src/alias.json`)).status).toBe(403);
      expect((await fetch(`${origin}/@id/@template/db/remote`)).status).toBe(403);
      for (const other of apps.filter((name) => name !== app)) {
        expect((await fetch(`${origin}/@id/@template/${other}`)).status).toBe(403);
        const encoded = `%${other.charCodeAt(0).toString(16)}${other.slice(1)}`;
        expect(
          (await fetch(`${origin}/@fs/${root}/apps/${encoded}/src/private.js?raw`)).status,
        ).toBe(403);
      }
    } finally {
      await server.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
);
