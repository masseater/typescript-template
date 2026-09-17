import { expect, test } from "vitest";
import { assertPublicFile, secretValues, assertEntries, assertSeparation } from "./artifacts.ts";
import type { ArtifactPair } from "./artifacts.ts";

function data(): ArtifactPair {
  return {
    secrets: [],
    user: {
      name: "user",
      directory: "/test/user/dist",
      entry: "index.js",
      workerFirst: true,
      server: new Map([["index.js", Buffer.from('export default { audience: "user" }')]]),
      client: new Map([["assets/index-user.js", Buffer.from('document.title = "プロフィール";')]]),
    },
    admin: {
      name: "admin",
      directory: "/test/admin/dist",
      entry: "index.js",
      workerFirst: true,
      server: new Map([
        [
          "index.js",
          Buffer.from(
            'export default { audience: "admin", markers: ["ADMIN_STRONG_SESSION_REQUIRED", "LOCAL_ADMIN_PASSWORD", "/api/users"] }',
          ),
        ],
      ]),
      client: new Map([["assets/index-admin.js", Buffer.from('document.title = "ユーザー管理";')]]),
    },
  };
}

test.for([
  "assets/chunk.js.map",
  "assets/chunk.js.map.br",
  ".dev.vars",
  ".dev.vars.preview",
  ".env.local",
  "server/wrangler.json",
  ".local/db.sqlite",
  "private.key",
])("rejects public private artifact %s", (filename) => {
  expect(() => assertPublicFile(filename, Buffer.from("content"), [])).toThrow(
    "E2E_ARTIFACT_PRIVATE_FILE_IN_PUBLIC_DIRECTORY",
  );
});

test.for([
  "//# sourceMappingURL=chunk.js.map",
  "/*# sourceMappingURL=data:application/json;base64,e30= */",
])("rejects sourcemap comment %s", (content) => {
  expect(() => assertPublicFile("assets/index.js", Buffer.from(content), [])).toThrow(
    "E2E_ARTIFACT_PUBLIC_SOURCEMAP_REFERENCE",
  );
});

test("rejects actual local secret values without exposing their content in errors", () => {
  const secrets = secretValues(
    'AUTH_SECRET="public-policy-canary"\nAPP_ORIGIN=http://localhost:3001\nSENTRY_DSN=https://public@example.test/1\n',
  );
  expect(secrets).toEqual(["public-policy-canary"]);
  expect(() =>
    assertPublicFile(
      "assets/index.js",
      Buffer.from('const leaked = "public-policy-canary"'),
      secrets,
    ),
  ).toThrow(/^E2E_ARTIFACT_LOCAL_SECRET_IN_PUBLIC_BUNDLE$/);
  expect(() =>
    assertPublicFile(
      "assets/index.js",
      Buffer.from(Buffer.from("public-policy-canary").toString("base64")),
      secrets,
    ),
  ).toThrow(/^E2E_ARTIFACT_LOCAL_SECRET_IN_PUBLIC_BUNDLE$/);
  expect(() =>
    assertPublicFile(
      "assets/index.js",
      Buffer.from('const publicDsn = "https://public@example.test/1"'),
      secrets,
    ),
  ).not.toThrow();
});

test("rejects shared Worker names, missing entries and static-asset gate bypass", () => {
  const pair = data();
  expect(() => assertEntries(pair)).not.toThrow();
  expect(() => assertEntries({ ...pair, admin: { ...pair.admin, name: pair.user.name } })).toThrow(
    "E2E_ARTIFACT_WORKERS_NOT_SEPARATE",
  );
  expect(() => assertEntries({ ...pair, user: { ...pair.user, entry: "missing.js" } })).toThrow(
    "E2E_ARTIFACT_WORKER_ENTRY_MISSING",
  );
  expect(() => assertEntries({ ...pair, admin: { ...pair.admin, workerFirst: false } })).toThrow(
    "E2E_ARTIFACT_WORKER_GATE_BYPASSED",
  );
});

test("admin absence checks require a positive admin control and inspect source-map module identities", () => {
  const pair = data();
  expect(() => assertSeparation(pair)).not.toThrow();
  expect(() =>
    assertSeparation({ ...pair, admin: { ...pair.admin, server: pair.user.server } }),
  ).toThrow("E2E_ADMIN_ROUTE_MARKER_MISSING");
  expect(() =>
    assertSeparation({ ...pair, user: { ...pair.user, server: pair.admin.server } }),
  ).toThrow("E2E_ADMIN_ROUTE_IN_USER_BUNDLE");
  const server = new Map(pair.user.server);
  server.set(
    "index.js.map",
    Buffer.from(JSON.stringify({ sources: ["../../../../apps/admin/src/routes/api.users.ts"] })),
  );
  expect(() => assertSeparation({ ...pair, user: { ...pair.user, server } })).toThrow(
    "E2E_ADMIN_SOURCE_IN_USER_SERVER_MAP",
  );
});

test("a shared OAuth provider URL does not count as an admin application route", () => {
  const pair = data();
  pair.user.server.set("oauth.js", Buffer.from('fetch("https://discord.com/api/users/@me")'));
  expect(() => assertSeparation(pair)).not.toThrow();
  pair.user.server.set("leaked-route.js", Buffer.from('const route = "/api/users"'));
  expect(() => assertSeparation(pair)).toThrow("E2E_ADMIN_ROUTE_IN_USER_BUNDLE");
});
