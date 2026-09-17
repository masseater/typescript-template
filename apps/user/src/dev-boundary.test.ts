import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "vite-plus";
import { expect, test } from "vitest";
import { userDevBoundary } from "../dev-boundary.ts";

test("user Vite serves its app but rejects secret files and administrator sources", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "user-dev-boundary-"));
  const root = await realpath(directory);
  const app = path.join(root, "apps/user");
  for (const folder of [
    "apps/user/src",
    "apps/admin/src",
    "packages/db/src",
    "packages/ui",
    ".local",
    "internal",
  ])
    await mkdir(path.join(root, folder), { recursive: true });
  await writeFile(
    path.join(app, "index.html"),
    '<html><body>User<script type="module" src="/src/entry.js"></script></body></html>',
  );
  await writeFile(path.join(app, "src/entry.js"), 'export const label = "user-module";');
  await writeFile(
    path.join(root, "apps/admin/src/private.js"),
    'export const label = "private-admin-module";',
  );
  await writeFile(
    path.join(root, "packages/db/src/admin.ts"),
    'export const label = "private-admin-database";',
  );
  await writeFile(path.join(root, ".local/runtime.json"), '{"password":"test-secret-marker"}');
  await writeFile(
    path.join(root, "internal/private.js"),
    'export const label = "private-internal-module";',
  );
  await symlink(path.join(root, ".local/runtime.json"), path.join(app, "src/alias.json"));
  const server = await createServer({
    configFile: false,
    root: app,
    plugins: [userDevBoundary(root)],
    server: { host: "127.0.0.1", port: 0, strictPort: true },
    logLevel: "silent",
  });
  try {
    await server.listen();
    const address = server.httpServer?.address();
    if (!address || typeof address === "string") throw new Error("TEST_SERVER_ADDRESS_REQUIRED");
    const origin = `http://127.0.0.1:${address.port}`;
    expect((await fetch(`${origin}/`)).status).toBe(200);
    expect(await (await fetch(`${origin}/src/entry.js`)).text()).toContain("user-module");
    expect((await fetch(`${origin}/@vite/client`)).status).toBe(200);
    for (const file of [
      ".local/runtime.json",
      "apps/admin/src/private.js",
      "packages/db/src/admin.ts",
      "internal/private.js",
    ]) {
      for (const suffix of ["", "?raw", "?import"]) {
        const response = await fetch(`${origin}/@fs/${root}/${file}${suffix}`);
        expect(response.status).toBe(403);
        expect(await response.text()).not.toMatch(/test-secret-marker|private-admin/);
      }
    }
    for (const file of ["/src/alias.json", "/@id/@template/admin", "/@id/@template/db/admin"])
      expect((await fetch(`${origin}${file}`)).status).toBe(403);
    expect((await fetch(`${origin}/@fs/${root}/apps/%61dmin/src/private.js?raw`)).status).toBe(403);
  } finally {
    await server.close();
    await rm(directory, { recursive: true, force: true });
  }
});
