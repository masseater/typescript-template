import { assert, it } from "@effect/vitest";
import { readWikiConfig } from "@template/config";
import { Effect } from "effect";
import {
  appPolicy,
  parseSharedConfig,
  parseDeploymentCommand,
  selectObservabilityQueryPermission,
  selectReadPermission,
  validateAuthSecret,
} from "./config.ts";
import type { CloudflareFailure } from "./config.ts";

const settings = {
  accountId: "a".repeat(32),
  zoneId: "b".repeat(32),
  prefix: "template-test",
  userOrigin: "https://user.example.com",
  adminOrigin: "https://admin.example.com",
  wikiOrigin: "https://wiki.example.com",
  mailFrom: "mail@example.com",
  budget: {
    budgetJpy: 5000,
    jpyPerUsd: 150,
    fixedCostUsd: 5,
    reserveUsd: 2,
    recipients: ["billing@example.com"],
  },
};

const code = <A, R>(effect: Effect.Effect<A, CloudflareFailure, R>) =>
  effect.pipe(
    Effect.flip,
    Effect.map((failure) => failure.code),
  );

it.effect(
  "deployment commands reject ignored arguments instead of selecting an unintended stack",
  () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(yield* parseDeploymentCommand(["preview", "admin"]), {
        operation: "preview",
        target: "admin",
      });
      assert.strictEqual(
        yield* code(parseDeploymentCommand(["up", "user", "--stack", "other"])),
        "deployment_command_invalid",
      );
      assert.deepStrictEqual(yield* parseDeploymentCommand(["up", "wiki"]), {
        operation: "up",
        target: "wiki",
      });
      assert.strictEqual(
        yield* code(parseDeploymentCommand(["up", "unknown"])),
        "deployment_command_invalid",
      );
    }),
);

it.effect("user and admin are distinct deployments with all alternative public URLs disabled", () =>
  Effect.gen(function* () {
    const config = yield* parseSharedConfig(settings);
    assert.deepStrictEqual(appPolicy(config, "user"), {
      name: "template-test-user",
      origin: settings.userOrigin,
      subdomain: { enabled: false, previewsEnabled: false },
      assets: { runWorkerFirst: true },
    });
    assert.strictEqual(appPolicy(config, "admin").name, "template-test-admin");
    assert.deepStrictEqual(appPolicy(config, "admin").subdomain, {
      enabled: false,
      previewsEnabled: false,
    });
    assert.isTrue(appPolicy(config, "admin").assets.runWorkerFirst);
    assert.deepStrictEqual(appPolicy(config, "wiki"), {
      name: "template-test-wiki",
      origin: settings.wikiOrigin,
      subdomain: { enabled: false, previewsEnabled: false },
      assets: { runWorkerFirst: true },
    });
  }),
);

it.effect("the wiki reads authentication, database and optional AI bindings", () =>
  Effect.gen(function* () {
    const config = yield* parseSharedConfig(settings);
    const bindings = {
      APP_ORIGIN: appPolicy(config, "wiki").origin,
      AUTH_SECRET: "wiki-runtime-secret-at-least-32-characters",
      APP_RELEASE: "0123456789abcdef",
      EMAIL_FROM: config.mailFrom,
      ASSETS: { fetch: () => Promise.resolve(new Response()) },
      DB: { prepare: () => undefined, batch: () => Promise.resolve([]) },
      EMAIL: { send: () => Promise.resolve() },
    };
    const runtime = yield* readWikiConfig(bindings);
    assert.strictEqual(runtime.APP_ORIGIN, settings.wikiOrigin);
    assert.strictEqual(runtime.APP_RELEASE, "0123456789abcdef");
    assert.isUndefined(runtime.AI);
    const ai = { run: () => Promise.resolve({ data: [] }) };
    assert.strictEqual<unknown>((yield* readWikiConfig({ ...bindings, AI: ai })).AI, ai);
    const missing = yield* readWikiConfig({ ...bindings, DB: undefined }).pipe(Effect.flip);
    assert.strictEqual(missing._tag, "ConfigurationInvalid");
  }),
);

for (const adminOrigin of [
  "http://admin.example.com",
  "https://admin.example.com/path",
  "https://admin.example.com/",
  "https://admin.example.com?x=1",
  "https://app.team.workers.dev",
  "not-a-url",
])
  it.effect(`rejects unsafe admin origin ${adminOrigin}`, () =>
    Effect.gen(function* () {
      assert.strictEqual(
        yield* code(parseSharedConfig({ ...settings, adminOrigin })),
        "cloudflare_settings_invalid",
      );
    }),
  );

it.effect("rejects same origins", () =>
  Effect.gen(function* () {
    assert.strictEqual(
      yield* code(parseSharedConfig({ ...settings, adminOrigin: settings.userOrigin })),
      "app_origins_must_differ",
    );
  }),
);

it.effect("refuses a budget exhausted by fixed fees", () =>
  Effect.gen(function* () {
    assert.strictEqual(
      yield* code(
        parseSharedConfig({ ...settings, budget: { ...settings.budget, fixedCostUsd: 50 } }),
      ),
      "budget_has_no_usage_allowance",
    );
  }),
);

it.effect("selects Billing Read only and refuses substituted write scopes", () =>
  Effect.gen(function* () {
    const read = {
      id: "c".repeat(32),
      name: "Billing Read",
      scopes: ["com.cloudflare.api.account"],
    };
    assert.strictEqual(
      yield* selectReadPermission([read, { ...read, name: "Billing Edit" }]),
      read.id,
    );
    assert.strictEqual(
      yield* code(selectReadPermission([{ ...read, name: "Billing Edit" }])),
      "billing_read_permission_unavailable",
    );
    assert.strictEqual(
      yield* code(selectReadPermission([read, read])),
      "billing_read_permission_unavailable",
    );
  }),
);

it.effect("secret validation errors do not include their inputs", () =>
  Effect.gen(function* () {
    const failure = yield* validateAuthSecret("private-value").pipe(Effect.flip);
    assert.strictEqual(failure.code, "auth_secret_invalid");
    assert.notInclude(JSON.stringify(failure), "private-value");
    assert.notInclude(String(failure), "private-value");
    assert.strictEqual(yield* validateAuthSecret("x".repeat(32)), "x".repeat(32));
  }),
);

it.effect("the error monitor token may only run Workers Observability queries", () =>
  Effect.gen(function* () {
    const write = {
      id: "d".repeat(32),
      name: "Workers Observability Write",
      scopes: ["com.cloudflare.api.account"],
    };
    assert.strictEqual(
      yield* selectObservabilityQueryPermission([
        write,
        { ...write, name: "Workers Scripts Write" },
      ]),
      write.id,
    );
    assert.strictEqual(
      yield* code(
        selectObservabilityQueryPermission([{ ...write, name: "Workers Scripts Write" }]),
      ),
      "observability_query_permission_unavailable",
    );
  }),
);
