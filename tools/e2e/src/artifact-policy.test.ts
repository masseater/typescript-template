import { expect, test } from "vite-plus/test";
import {
  assertPublicFile,
  secretValues,
  assertEntries,
  assertSeparation,
  sourcePaths,
} from "./artifacts.ts";
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
      sources: {
        server: ["libs/runtime/src/worker.ts", "apps/user/src/server.ts"],
        client: ["libs/ui/src/shell.tsx", "apps/user/src/routes/index.tsx"],
      },
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
      sources: {
        server: ["apps/admin/src/access.ts", "libs/db/src/admin.ts"],
        client: ["libs/ui/src/shell.tsx", "apps/admin/src/routes/index.tsx"],
      },
    },
    wiki: {
      name: "wiki",
      directory: "/test/wiki/dist",
      entry: "index.js",
      workerFirst: true,
      server: new Map([["index.js", Buffer.from('ai.run("@cf/baai/bge-m3", { text })')]]),
      client: new Map([["assets/index-wiki.js", Buffer.from('document.title = "Wiki";')]]),
      sources: { server: ["apps/wiki/src/server.ts"], client: ["apps/wiki/src/router.tsx"] },
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
    'AUTH_SECRET="public-policy-canary"\nAPP_ORIGIN=http://localhost:3001\nMAILPIT_URL=http://127.0.0.1:8025\n',
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
  const serverSources = sourcePaths(
    new Map([
      [
        "assets/users.js.map",
        Buffer.from(JSON.stringify({ sources: ["../../../../admin/src/routes/api.users.ts"] })),
      ],
    ]),
    "apps/user/dist/server",
  );
  expect(serverSources).toEqual(["apps/admin/src/routes/api.users.ts"]);
  expect(() =>
    assertSeparation({
      ...pair,
      user: { ...pair.user, sources: { ...pair.user.sources, server: serverSources } },
    }),
  ).toThrow("E2E_ADMIN_SOURCE_IN_USER_SERVER_MAP");
  const clientSources = sourcePaths(
    new Map([
      [
        "assets/index.js.map",
        Buffer.from(
          JSON.stringify({
            sources: ["../../../src/routes/index.tsx", "../../../../../libs/db/src/remote-cli.ts"],
          }),
        ),
      ],
    ]),
    "apps/user/dist/client",
  );
  expect(clientSources).toEqual(["apps/user/src/routes/index.tsx", "libs/db/src/remote-cli.ts"]);
  expect(() =>
    assertSeparation({
      ...pair,
      user: { ...pair.user, sources: { ...pair.user.sources, client: clientSources } },
    }),
  ).toThrow("E2E_ADMIN_SOURCE_IN_USER_CLIENT_MAP");
});

test("source-map checks fail when the builds they compare lack their expected sources", () => {
  const pair = data();
  expect(() =>
    assertSeparation({ ...pair, admin: { ...pair.admin, sources: { server: [], client: [] } } }),
  ).toThrow("E2E_ADMIN_SERVER_MAP_CONTROL_MISSING");
  expect(() =>
    assertSeparation({
      ...pair,
      admin: { ...pair.admin, sources: { ...pair.admin.sources, client: [] } },
    }),
  ).toThrow("E2E_ADMIN_CLIENT_MAP_CONTROL_MISSING");
  expect(() =>
    assertSeparation({ ...pair, user: { ...pair.user, sources: { server: [], client: [] } } }),
  ).toThrow("E2E_USER_CLIENT_MAP_CONTROL_MISSING");
  expect(() =>
    assertSeparation({ ...pair, wiki: { ...pair.wiki, sources: { server: [], client: [] } } }),
  ).toThrow("E2E_WIKI_SERVER_MAP_CONTROL_MISSING");
  expect(
    sourcePaths(
      new Map([
        [
          "index.js.map",
          Buffer.from(
            JSON.stringify({
              sources: ["../../../../node_modules/react/index.js", "../../../../../../outside.ts"],
            }),
          ),
        ],
      ]),
      "apps/user/dist/server",
    ),
  ).toEqual([]);
});

test("the public wiki bundle is a separate Worker without application routes or sources", () => {
  const pair = data();
  expect(() => assertEntries({ ...pair, wiki: { ...pair.wiki, name: pair.user.name } })).toThrow(
    "E2E_ARTIFACT_WORKERS_NOT_SEPARATE",
  );
  expect(() =>
    assertSeparation({ ...pair, wiki: { ...pair.wiki, server: pair.user.server } }),
  ).toThrow("E2E_WIKI_SERVER_MARKER_MISSING");
  const leaked = new Map(pair.wiki.server);
  leaked.set("auth.js", Buffer.from('fetch("/api/auth/get-session")'));
  expect(() => assertSeparation({ ...pair, wiki: { ...pair.wiki, server: leaked } })).toThrow(
    "E2E_APPLICATION_CODE_IN_WIKI_BUNDLE",
  );
  const mapped = sourcePaths(
    new Map([
      [
        "index.js.map",
        Buffer.from(JSON.stringify({ sources: ["../../../../libs/db/src/schema.ts"] })),
      ],
    ]),
    "apps/wiki/dist/server",
  );
  expect(() =>
    assertSeparation({
      ...pair,
      wiki: {
        ...pair.wiki,
        sources: { ...pair.wiki.sources, server: [...pair.wiki.sources.server, ...mapped] },
      },
    }),
  ).toThrow("E2E_APPLICATION_SOURCE_IN_WIKI_SERVER_MAP");
  expect(() =>
    assertSeparation({
      ...pair,
      wiki: { ...pair.wiki, sources: { ...pair.wiki.sources, client: ["libs/ui/src/auth.tsx"] } },
    }),
  ).toThrow("E2E_APPLICATION_SOURCE_IN_WIKI_CLIENT_MAP");
});

test("a shared OAuth provider URL does not count as an admin application route", () => {
  const pair = data();
  pair.user.server.set("oauth.js", Buffer.from('fetch("https://discord.com/api/users/@me")'));
  expect(() => assertSeparation(pair)).not.toThrow();
  pair.user.server.set("leaked-route.js", Buffer.from('const route = "/api/users"'));
  expect(() => assertSeparation(pair)).toThrow("E2E_ADMIN_ROUTE_IN_USER_BUNDLE");
});
