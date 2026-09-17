import { assert, it } from "@effect/vitest";
import { Effect } from "effect";
import { assertPublicFile, secretValues, assertEntries, assertSeparation } from "./artifacts.ts";
import type { ArtifactPair } from "./artifacts.ts";
import type { E2eFailure } from "./support.ts";

const code = <A, R>(effect: Effect.Effect<A, E2eFailure, R>) =>
  effect.pipe(
    Effect.flip,
    Effect.map((failure) => failure.code),
  );

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
            'export default { audience: "admin", markers: ["AdminStrongSessionRequired", "LOCAL_ADMIN_PASSWORD", "/api/users"] }',
          ),
        ],
      ]),
      client: new Map([["assets/index-admin.js", Buffer.from('document.title = "ユーザー管理";')]]),
    },
    wiki: {
      name: "wiki",
      directory: "/test/wiki/dist",
      entry: "index.js",
      workerFirst: true,
      server: new Map([["index.js", Buffer.from('ai.run("@cf/baai/bge-m3", { text })')]]),
      client: new Map([["assets/index-wiki.js", Buffer.from('document.title = "Wiki";')]]),
    },
  };
}

it.effect.each([
  "assets/chunk.js.map",
  "assets/chunk.js.map.br",
  ".dev.vars",
  ".dev.vars.preview",
  ".env.local",
  "server/wrangler.json",
  ".local/db.sqlite",
  "private.key",
])("rejects public private artifact %s", (filename) =>
  Effect.gen(function* () {
    assert.strictEqual(
      yield* code(assertPublicFile(filename, Buffer.from("content"), [])),
      "E2E_ARTIFACT_PRIVATE_FILE_IN_PUBLIC_DIRECTORY",
    );
  }),
);

it.effect.each([
  "//# sourceMappingURL=chunk.js.map",
  "/*# sourceMappingURL=data:application/json;base64,e30= */",
])("rejects sourcemap comment %s", (content) =>
  Effect.gen(function* () {
    assert.strictEqual(
      yield* code(assertPublicFile("assets/index.js", Buffer.from(content), [])),
      "E2E_ARTIFACT_PUBLIC_SOURCEMAP_REFERENCE",
    );
  }),
);

it.effect("rejects actual local secret values without exposing their content in errors", () =>
  Effect.gen(function* () {
    const secrets = secretValues(
      'AUTH_SECRET="public-policy-canary"\nAPP_ORIGIN=http://localhost:3001\nMAILPIT_URL=http://127.0.0.1:8025\n',
    );
    assert.deepStrictEqual(secrets, ["public-policy-canary"]);
    for (const leaked of [
      'const leaked = "public-policy-canary"',
      Buffer.from("public-policy-canary").toString("base64"),
    ]) {
      const failure = yield* Effect.flip(
        assertPublicFile("assets/index.js", Buffer.from(leaked), secrets),
      );
      assert.strictEqual(failure.code, "E2E_ARTIFACT_LOCAL_SECRET_IN_PUBLIC_BUNDLE");
      assert.notInclude(JSON.stringify(failure), "canary");
    }
    yield* assertPublicFile(
      "assets/index.js",
      Buffer.from('const publicDsn = "https://public@example.test/1"'),
      secrets,
    );
  }),
);

it.effect("rejects shared Worker names, missing entries and static-asset gate bypass", () =>
  Effect.gen(function* () {
    const pair = data();
    yield* assertEntries(pair);
    assert.strictEqual(
      yield* code(assertEntries({ ...pair, admin: { ...pair.admin, name: pair.user.name } })),
      "E2E_ARTIFACT_WORKERS_NOT_SEPARATE",
    );
    assert.strictEqual(
      yield* code(assertEntries({ ...pair, user: { ...pair.user, entry: "missing.js" } })),
      "E2E_ARTIFACT_WORKER_ENTRY_MISSING",
    );
    assert.strictEqual(
      yield* code(assertEntries({ ...pair, admin: { ...pair.admin, workerFirst: false } })),
      "E2E_ARTIFACT_WORKER_GATE_BYPASSED",
    );
  }),
);

it.effect(
  "admin absence checks require a positive admin control and inspect source-map module identities",
  () =>
    Effect.gen(function* () {
      const pair = data();
      yield* assertSeparation(pair);
      assert.strictEqual(
        yield* code(
          assertSeparation({ ...pair, admin: { ...pair.admin, server: pair.user.server } }),
        ),
        "E2E_ADMIN_ROUTE_MARKER_MISSING",
      );
      assert.strictEqual(
        yield* code(
          assertSeparation({ ...pair, user: { ...pair.user, server: pair.admin.server } }),
        ),
        "E2E_ADMIN_ROUTE_IN_USER_BUNDLE",
      );
      const server = new Map(pair.user.server);
      server.set(
        "index.js.map",
        Buffer.from(
          JSON.stringify({ sources: ["../../../../apps/admin/src/routes/api.users.ts"] }),
        ),
      );
      assert.strictEqual(
        yield* code(assertSeparation({ ...pair, user: { ...pair.user, server } })),
        "E2E_ADMIN_SOURCE_IN_USER_SERVER_MAP",
      );
    }),
);

it.effect("the public wiki bundle is a separate Worker without application routes or sources", () =>
  Effect.gen(function* () {
    const pair = data();
    assert.strictEqual(
      yield* code(assertEntries({ ...pair, wiki: { ...pair.wiki, name: pair.user.name } })),
      "E2E_ARTIFACT_WORKERS_NOT_SEPARATE",
    );
    assert.strictEqual(
      yield* code(assertSeparation({ ...pair, wiki: { ...pair.wiki, server: pair.user.server } })),
      "E2E_WIKI_SERVER_MARKER_MISSING",
    );
    const leaked = new Map(pair.wiki.server);
    leaked.set("auth.js", Buffer.from('fetch("/api/auth/get-session")'));
    assert.strictEqual(
      yield* code(assertSeparation({ ...pair, wiki: { ...pair.wiki, server: leaked } })),
      "E2E_APPLICATION_CODE_IN_WIKI_BUNDLE",
    );
    const mapped = new Map(pair.wiki.server);
    mapped.set(
      "index.js.map",
      Buffer.from(JSON.stringify({ sources: ["../../../../libs/db/src/schema.ts"] })),
    );
    assert.strictEqual(
      yield* code(assertSeparation({ ...pair, wiki: { ...pair.wiki, server: mapped } })),
      "E2E_APPLICATION_SOURCE_IN_WIKI_SERVER_MAP",
    );
  }),
);

it.effect("a shared OAuth provider URL does not count as an admin application route", () =>
  Effect.gen(function* () {
    const pair = data();
    pair.user.server.set("oauth.js", Buffer.from('fetch("https://discord.com/api/users/@me")'));
    yield* assertSeparation(pair);
    pair.user.server.set("leaked-route.js", Buffer.from('const route = "/api/users"'));
    assert.strictEqual(yield* code(assertSeparation(pair)), "E2E_ADMIN_ROUTE_IN_USER_BUNDLE");
  }),
);
