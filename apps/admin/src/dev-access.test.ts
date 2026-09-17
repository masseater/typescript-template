import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { request } from "node:http";
import type { IncomingHttpHeaders } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createServer } from "vite-plus";
import { expect, test as baseTest } from "vitest";
import { adminDevAccess } from "../dev-access.ts";

const origin = "http://localhost:3002";

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "admin-dev-access-"));
  const password = crypto.randomUUID();
  const credentialsFile = pathToFileURL(path.join(root, ".dev.vars"));
  await writeFile(
    credentialsFile,
    `APP_ORIGIN=${JSON.stringify(origin)}\nLOCAL_ADMIN_USER="operator"\nLOCAL_ADMIN_PASSWORD=${JSON.stringify(password)}\n`,
    { mode: 0o600 },
  );
  await mkdir(path.join(root, "src"));
  await mkdir(path.join(root, ".local"));
  await writeFile(
    path.join(root, "index.html"),
    '<html><body>Administrator<script type="module" src="/src/admin.js"></script></body></html>',
  );
  await writeFile(path.join(root, "src/admin.js"), 'export const label = "administrator-module";');
  await writeFile(path.join(root, ".local/runtime.json"), JSON.stringify({ password }));
  const server = await createServer({
    configFile: false,
    root,
    plugins: [adminDevAccess(credentialsFile)],
    server: { host: "127.0.0.1", port: 0, strictPort: true },
    logLevel: "silent",
  });
  try {
    await server.listen();
    const address = server.httpServer?.address();
    if (!address || typeof address === "string") throw new Error("TEST_SERVER_ADDRESS_REQUIRED");
    const authorization = `Basic ${btoa(`operator:${password}`)}`;
    const fetchPath = (pathname: string, authorized: boolean, extra: Record<string, string> = {}) =>
      new Promise<{
        status: number;
        body: string;
        headers: IncomingHttpHeaders;
      }>((resolve, reject) => {
        const call = request(
          {
            host: "127.0.0.1",
            port: address.port,
            path: pathname,
            headers: {
              host: new URL(origin).host,
              ...(authorized ? { authorization } : {}),
              ...extra,
            },
          },
          (response) => {
            const chunks: string[] = [];
            response.setEncoding("utf8");
            response.on("data", (chunk: string) => chunks.push(chunk));
            response.on("end", () =>
              resolve({
                status: response.statusCode ?? 0,
                body: chunks.join(""),
                headers: response.headers,
              }),
            );
          },
        );
        call.on("error", reject);
        call.end();
      });
    const upgrade = (
      pathname: string,
      authorized: boolean,
      requestOrigin: string | null = origin,
      protocol = "vite-hmr",
    ) =>
      new Promise<number>((resolve, reject) => {
        const call = request({
          host: "127.0.0.1",
          port: address.port,
          path: pathname,
          headers: {
            host: new URL(origin).host,
            connection: "Upgrade",
            upgrade: "websocket",
            "sec-websocket-version": "13",
            "sec-websocket-key": btoa(
              String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))),
            ),
            "sec-websocket-protocol": protocol,
            ...(requestOrigin ? { origin: requestOrigin } : {}),
            ...(authorized ? { authorization } : {}),
          },
        });
        call.on("response", (response) => {
          response.resume();
          resolve(response.statusCode ?? 0);
        });
        call.on("upgrade", (response, socket) => {
          socket.destroy();
          resolve(response.statusCode ?? 0);
        });
        call.on("error", reject);
        call.setTimeout(3000, () => call.destroy(new Error("WEBSOCKET_VERIFICATION_TIMEOUT")));
        call.end();
      });
    return {
      server,
      root,
      credentialsFile,
      fetchPath,
      upgrade,
      dispose: async () => {
        await server.close();
        await rm(root, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await server.close();
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}

const test = baseTest.extend<{ dev: Awaited<ReturnType<typeof fixture>> }>({
  dev: async ({}, provide) => {
    const dev = await fixture();
    try {
      await provide(dev);
    } finally {
      await dev.dispose();
    }
  },
});

test("all Vite HTTP paths require entry authentication before delivery", async ({ dev }) => {
  for (const pathname of [
    "/",
    "/login",
    "/@vite/client",
    "/@react-refresh",
    "/src/admin.js",
    "/node_modules/.vite/deps/react.js",
    "/@id/virtual:test",
    `/@fs/${dev.root}/src/admin.js`,
    "/src/admin.js?raw",
    "/.dev.vars",
    "/.local/runtime.json",
    "/api/users",
  ]) {
    const response = await dev.fetchPath(pathname, false);
    expect(response.status).toBe(401);
    expect(response.body).toBe("Authentication required");
    expect(response.headers["cache-control"]).toBe("no-store");
  }
  expect((await dev.fetchPath("/", true)).status).toBe(200);
  expect((await dev.fetchPath("/src/admin.js", true)).body).toContain("administrator-module");
  expect((await dev.fetchPath("/@vite/client", true)).status).toBe(200);
  const cachedModule = await dev.fetchPath("/src/admin.js", true);
  expect(
    (
      await dev.fetchPath("/src/admin.js", false, {
        "if-none-match": String(cachedModule.headers["etag"]),
      })
    ).status,
  ).toBe(401);
  expect((await dev.fetchPath("/@vite/client", false)).status).toBe(401);
  expect(
    (await dev.fetchPath("/@vite/client", true, { authorization: "Basic invalid!" })).status,
  ).toBe(401);
  expect(
    (
      await dev.fetchPath("/@vite/client", true, {
        authorization: `Basic ${btoa("operator:incorrect")}`,
      })
    ).status,
  ).toBe(401);
  expect(
    (await dev.fetchPath("/src/admin.js", true, { origin: "https://attacker.invalid" })).status,
  ).toBe(401);
  expect((await dev.fetchPath("/src/admin.js", true, { host: "attacker.invalid" })).status).toBe(
    403,
  );
});

test("credential files are not served even with valid entry authentication", async ({ dev }) => {
  for (const pathname of [
    "/.dev.vars",
    "/.dev.vars?raw",
    "/.dev.vars?url",
    "/.local/runtime.json",
    `/@fs/${dev.root}/.dev.vars`,
    `/@fs/${dev.root}/.local/runtime.json`,
  ]) {
    expect((await dev.fetchPath(pathname, true)).status).toBe(403);
  }
});

test("HMR requires Basic authentication and the exact local origin even with a valid Vite token", async ({
  dev,
}) => {
  const client = await dev.fetchPath("/@vite/client", true);
  const token = /const wsToken = "([^"]+)"/.exec(client.body)?.[1];
  if (!token) throw new Error("VITE_CLIENT_WEBSOCKET_TOKEN_REQUIRED");
  const pathname = `/?token=${encodeURIComponent(token)}`;
  expect(await dev.upgrade(pathname, false)).toBe(401);
  expect(await dev.upgrade(pathname, true, "https://attacker.invalid")).toBe(401);
  expect(await dev.upgrade(pathname, true, null)).toBe(401);
  expect(await dev.upgrade(pathname, false, origin, "vite-invoke")).toBe(401);
  expect(await dev.upgrade(pathname, false, origin, "custom-worker-websocket")).toBe(401);
  expect(await dev.upgrade(pathname, true)).toBe(101);
});

test("insecure credential permissions prevent development server startup", async ({ dev }) => {
  await chmod(dev.credentialsFile, 0o644);
  await expect(
    createServer({
      configFile: false,
      root: dev.root,
      plugins: [adminDevAccess(dev.credentialsFile)],
      server: { host: "127.0.0.1", port: 0 },
      logLevel: "silent",
    }),
  ).rejects.toThrow("ADMIN_DEV_CREDENTIALS_REQUIRE_MODE_0600");
});

test("external listening addresses prevent development server startup", async ({ dev }) => {
  await expect(
    createServer({
      configFile: false,
      root: dev.root,
      plugins: [adminDevAccess(dev.credentialsFile)],
      server: { host: "0.0.0.0", port: 0 },
      logLevel: "silent",
    }),
  ).rejects.toThrow("ADMIN_DEV_REQUIRES_LOCAL_SINGLE_HTTP_SERVER");
});

test("late upgrade handlers cannot bypass the authentication gate", ({ dev }) => {
  expect(() =>
    dev.server.httpServer?.on("upgrade", () => {
      throw new Error("UNREACHABLE_UNAUTHENTICATED_HANDLER");
    }),
  ).toThrow("ADMIN_DEV_UNGUARDED_UPGRADE_LISTENER_DENIED");
});
