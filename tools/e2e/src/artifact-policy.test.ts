import {
  assertEntries,
  assertPublicFile,
  assertSeparation,
  secretValues,
} from "./artifact-policy.ts";
import { describe, expect, it } from "vitest";
import type { ArtifactPair } from "./artifact-policy.ts";

function data(): ArtifactPair {
  return {
    admin: {
      client: new Map([["assets/index-admin.js", Buffer.from('document.title = "ユーザー管理";')]]),
      directory: "/test/admin/dist",
      entry: "index.js",
      name: "admin",
      server: new Map([
        [
          "index.js",
          Buffer.from(
            'export default { audience: "admin", markers: ["ADMIN_STRONG_SESSION_REQUIRED", "LOCAL_ADMIN_PASSWORD", "/api/users"] }',
          ),
        ],
      ]),
      workerFirst: true,
    },
    secrets: [],
    user: {
      client: new Map([["assets/index-user.js", Buffer.from('document.title = "プロフィール";')]]),
      directory: "/test/user/dist",
      entry: "index.js",
      name: "user",
      server: new Map([["index.js", Buffer.from('export default { audience: "user" }')]]),
      workerFirst: true,
    },
    wiki: {
      client: new Map([["assets/index-wiki.js", Buffer.from('document.title = "Wiki";')]]),
      directory: "/test/wiki/dist",
      entry: "index.js",
      name: "wiki",
      server: new Map([["index.js", Buffer.from('ai.run("@cf/baai/bge-m3", { text })')]]),
      workerFirst: true,
    },
  };
}

describe("public file policy", () => {
  it.for([
    "assets/chunk.js.map",
    "assets/chunk.js.map.br",
    ".dev.vars",
    ".dev.vars.preview",
    ".env.local",
    "server/wrangler.json",
    ".local/db.sqlite",
    "private.key",
  ])("rejects public private artifact %s", (filename) => {
    expect.hasAssertions();
    expect(() => {
      assertPublicFile(filename, Buffer.from("content"), []);
    }).toThrow("E2E_ARTIFACT_PRIVATE_FILE_IN_PUBLIC_DIRECTORY");
  });

  it.for([
    "//# sourceMappingURL=chunk.js.map",
    "/*# sourceMappingURL=data:application/json;base64,e30= */",
  ])("rejects sourcemap comment %s", (content) => {
    expect.hasAssertions();
    expect(() => {
      assertPublicFile("assets/index.js", Buffer.from(content), []);
    }).toThrow("E2E_ARTIFACT_PUBLIC_SOURCEMAP_REFERENCE");
  });
});

describe("local secret detection", () => {
  it("rejects actual local secret values without exposing their content in errors", () => {
    expect.hasAssertions();
    const secrets = secretValues(
      'AUTH_SECRET="public-policy-canary"\nAPP_ORIGIN=http://localhost:3001\nSENTRY_DSN=https://public@example.test/1\n',
    );
    expect(secrets).toStrictEqual(["public-policy-canary"]);
    expect(() => {
      assertPublicFile(
        "assets/index.js",
        Buffer.from('const leaked = "public-policy-canary"'),
        secrets,
      );
    }).toThrow(/^E2E_ARTIFACT_LOCAL_SECRET_IN_PUBLIC_BUNDLE$/u);
    expect(() => {
      assertPublicFile(
        "assets/index.js",
        Buffer.from(Buffer.from("public-policy-canary").toString("base64")),
        secrets,
      );
    }).toThrow(/^E2E_ARTIFACT_LOCAL_SECRET_IN_PUBLIC_BUNDLE$/u);
    expect(() => {
      assertPublicFile(
        "assets/index.js",
        Buffer.from('const publicDsn = "https://public@example.test/1"'),
        secrets,
      );
    }).not.toThrow();
  });
});

describe("worker entry policy", () => {
  it("rejects shared Worker names, missing entries and static-asset gate bypass", () => {
    expect.hasAssertions();
    const pair = data();
    expect(() => {
      assertEntries(pair);
    }).not.toThrow();
    expect(() => {
      assertEntries({ ...pair, admin: { ...pair.admin, name: pair.user.name } });
    }).toThrow("E2E_ARTIFACT_WORKERS_NOT_SEPARATE");
    expect(() => {
      assertEntries({ ...pair, user: { ...pair.user, entry: "missing.js" } });
    }).toThrow("E2E_ARTIFACT_WORKER_ENTRY_MISSING");
    expect(() => {
      assertEntries({ ...pair, admin: { ...pair.admin, workerFirst: false } });
    }).toThrow("E2E_ARTIFACT_WORKER_GATE_BYPASSED");
  });
});

describe("admin bundle separation", () => {
  it("admin absence checks require a positive admin control and inspect source-map module identities", () => {
    expect.hasAssertions();
    const pair = data();
    expect(() => {
      assertSeparation(pair);
    }).not.toThrow();
    expect(() => {
      assertSeparation({ ...pair, admin: { ...pair.admin, server: pair.user.server } });
    }).toThrow("E2E_ADMIN_ROUTE_MARKER_MISSING");
    expect(() => {
      assertSeparation({ ...pair, user: { ...pair.user, server: pair.admin.server } });
    }).toThrow("E2E_ADMIN_ROUTE_IN_USER_BUNDLE");
    const server = new Map([
      ...pair.user.server,
      [
        "index.js.map",
        Buffer.from(
          JSON.stringify({ sources: ["../../../../apps/admin/src/routes/api.users.ts"] }),
        ),
      ],
    ]);
    expect(() => {
      assertSeparation({ ...pair, user: { ...pair.user, server } });
    }).toThrow("E2E_ADMIN_SOURCE_IN_USER_SERVER_MAP");
  });
});

describe("wiki artifact isolation", () => {
  it("the public wiki bundle is a separate Worker without application routes or sources", () => {
    expect.hasAssertions();
    const pair = data();
    expect(() => {
      assertEntries({ ...pair, wiki: { ...pair.wiki, name: pair.user.name } });
    }).toThrow("E2E_ARTIFACT_WORKERS_NOT_SEPARATE");
    expect(() => {
      assertSeparation({ ...pair, wiki: { ...pair.wiki, server: pair.user.server } });
    }).toThrow("E2E_WIKI_SERVER_MARKER_MISSING");
    const leaked = new Map([
      ...pair.wiki.server,
      ["auth.js", Buffer.from('fetch("/api/auth/get-session")')],
    ]);
    expect(() => {
      assertSeparation({ ...pair, wiki: { ...pair.wiki, server: leaked } });
    }).toThrow("E2E_APPLICATION_CODE_IN_WIKI_BUNDLE");
    const mapped = new Map([
      ...pair.wiki.server,
      [
        "index.js.map",
        Buffer.from(JSON.stringify({ sources: ["../../../../libs/db/src/schema.ts"] })),
      ],
    ]);
    expect(() => {
      assertSeparation({ ...pair, wiki: { ...pair.wiki, server: mapped } });
    }).toThrow("E2E_APPLICATION_SOURCE_IN_WIKI_SERVER_MAP");
  });
});

describe("admin route detection", () => {
  it("a shared OAuth provider URL does not count as an admin application route", () => {
    expect.hasAssertions();
    const pair = data();
    const oauth = new Map([
      ...pair.user.server,
      ["oauth.js", Buffer.from('fetch("https://discord.com/api/users/@me")')],
    ]);
    expect(() => {
      assertSeparation({ ...pair, user: { ...pair.user, server: oauth } });
    }).not.toThrow();
    const leaked = new Map([
      ...oauth,
      ["leaked-route.js", Buffer.from('const route = "/api/users"')],
    ]);
    expect(() => {
      assertSeparation({ ...pair, user: { ...pair.user, server: leaked } });
    }).toThrow("E2E_ADMIN_ROUTE_IN_USER_BUNDLE");
  });
});
