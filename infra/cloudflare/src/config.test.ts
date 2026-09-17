import { ConfigurationInvalid, readWikiConfig } from "@template/config";
import { assert, it } from "@effect/vitest";
import {
  parseDeploymentCommand,
  parseSharedConfig,
  selectAccountPermission,
  validateAuthSecret,
  workerSubdomain,
} from "./config.ts";
import { Effect } from "effect";
import { applyPlan } from "./stacks.ts";

const HEX_32_LENGTH = 32;
const AUTH_SECRET_LENGTH = 32;

const authSecret = "x".repeat(AUTH_SECRET_LENGTH);
const release = "0123456789abcdef";
const assetsBinding = { fetch: async (): Promise<Response> => new Response() };
const databaseBinding = {
  batch: async (): Promise<never[]> => [],
  prepare: (): undefined => undefined,
};
const emailBinding = { send: async (): Promise<undefined> => undefined };
const aiBinding = { run: async (): Promise<{ data: never[] }> => ({ data: [] }) };
const settings = {
  accountId: "a".repeat(HEX_32_LENGTH),
  budget: {
    budgetJpy: 5000,
    fixedCostUsd: 5,
    jpyPerUsd: 150,
    recipients: ["billing@example.com"],
    reserveUsd: 2,
  },
  mailFrom: "mail@example.com",
  origins: {
    admin: "https://admin.example.com",
    user: "https://user.example.com",
    wiki: "https://wiki.example.com",
  },
  prefix: "template-test",
  zoneId: "b".repeat(HEX_32_LENGTH),
};

function code<Value, Failure extends { readonly code: string }, Requirements>(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  effect: Effect.Effect<Value, Failure, Requirements>,
): Effect.Effect<Failure["code"], Value, Requirements> {
  return effect.pipe(
    Effect.flip,
    Effect.map((failure) => failure.code),
  );
}

it.effect(
  "deployment commands reject ignored arguments instead of selecting an unintended stack",
  () =>
    Effect.gen(function* program() {
      assert.deepStrictEqual(yield* parseDeploymentCommand(["preview", "admin"]), {
        operation: "preview",
        targets: [{ dependencies: ["settings", "database"], stack: "admin" }],
      });
      assert.strictEqual(
        yield* code(parseDeploymentCommand(["up", "user", "--stack", "other"])),
        "deployment_command_invalid",
      );
      assert.deepStrictEqual(
        (yield* parseDeploymentCommand(["up", "wiki"])).targets.map(({ stack }) => stack),
        ["wiki"],
      );
      assert.deepStrictEqual(
        (yield* parseDeploymentCommand(["up", "all"])).targets,
        yield* applyPlan(),
      );
      assert.strictEqual(
        yield* code(parseDeploymentCommand(["up", "unknown"])),
        "deployment_command_invalid",
      );
      assert.strictEqual(
        yield* code(parseDeploymentCommand(["up", "shared"])),
        "deployment_command_invalid",
      );
    }),
);

it.effect("workers disable every alternative public URL", () =>
  Effect.sync(() => {
    assert.deepStrictEqual(workerSubdomain, { enabled: false, previewsEnabled: false });
  }),
);

it.effect("the wiki reads authentication, database and optional AI bindings", () =>
  Effect.gen(function* program() {
    const config = yield* parseSharedConfig(settings);
    const bindings = {
      APP_ORIGIN: config.origins.wiki,
      APP_RELEASE: release,
      ASSETS: assetsBinding,
      AUTH_SECRET: "wiki-runtime-secret-at-least-32-characters",
      DB: databaseBinding,
      EMAIL: emailBinding,
      EMAIL_FROM: config.mailFrom,
    };
    const runtime = yield* readWikiConfig(bindings);
    assert.strictEqual(runtime.APP_ORIGIN, settings.origins.wiki);
    assert.strictEqual(runtime.APP_RELEASE, release);
    assert.isUndefined(runtime.AI);
    assert.strictEqual<unknown>(
      (yield* readWikiConfig({ ...bindings, AI: aiBinding })).AI,
      aiBinding,
    );
    const missing = yield* readWikiConfig({ ...bindings, DB: undefined }).pipe(Effect.flip);
    assert.instanceOf(missing, ConfigurationInvalid);
  }),
);

for (const admin of [
  "http://admin.example.com",
  "https://admin.example.com/path",
  "https://admin.example.com/",
  "https://admin.example.com?x=1",
  "https://app.team.workers.dev",
  "not-a-url",
]) {
  it.effect(`rejects unsafe admin origin ${admin}`, () =>
    Effect.gen(function* program() {
      assert.strictEqual(
        yield* code(parseSharedConfig({ ...settings, origins: { ...settings.origins, admin } })),
        "cloudflare_settings_invalid",
      );
    }),
  );
}

it.effect("rejects same origins", () =>
  Effect.gen(function* program() {
    assert.strictEqual(
      yield* code(
        parseSharedConfig({
          ...settings,
          origins: { ...settings.origins, admin: settings.origins.user },
        }),
      ),
      "app_origins_must_differ",
    );
  }),
);

it.effect("refuses a budget exhausted by fixed fees", () =>
  Effect.gen(function* program() {
    assert.strictEqual(
      yield* code(
        parseSharedConfig({ ...settings, budget: { ...settings.budget, fixedCostUsd: 50 } }),
      ),
      "budget_has_no_usage_allowance",
    );
  }),
);

it.effect("selects Billing Read only and refuses substituted write scopes", () =>
  Effect.gen(function* program() {
    const read = {
      id: "c".repeat(HEX_32_LENGTH),
      name: "Billing Read",
      scopes: ["com.cloudflare.api.account"],
    };
    assert.strictEqual(
      yield* selectAccountPermission([read, { ...read, name: "Billing Edit" }], "Billing Read"),
      read.id,
    );
    assert.strictEqual(
      yield* code(selectAccountPermission([{ ...read, name: "Billing Edit" }], "Billing Read")),
      "account_permission_unavailable",
    );
    assert.strictEqual(
      yield* code(selectAccountPermission([read, read], "Billing Read")),
      "account_permission_unavailable",
    );
  }),
);

it.effect("secret validation errors do not include their inputs", () =>
  Effect.gen(function* program() {
    const failure = yield* validateAuthSecret("private-value").pipe(Effect.flip);
    assert.strictEqual(failure.code, "auth_secret_invalid");
    assert.notInclude(JSON.stringify(failure), "private-value");
    assert.notInclude(String(failure), "private-value");
    assert.strictEqual(yield* validateAuthSecret(authSecret), authSecret);
  }),
);

it.effect("the error monitor token may only run Workers Observability queries", () =>
  Effect.gen(function* program() {
    const write = {
      id: "d".repeat(HEX_32_LENGTH),
      name: "Workers Observability Write",
      scopes: ["com.cloudflare.api.account"],
    };
    assert.strictEqual(
      yield* selectAccountPermission(
        [write, { ...write, name: "Workers Scripts Write" }],
        "Workers Observability Write",
      ),
      write.id,
    );
    assert.strictEqual(
      yield* code(
        selectAccountPermission(
          [{ ...write, name: "Workers Scripts Write" }],
          "Workers Observability Write",
        ),
      ),
      "account_permission_unavailable",
    );
  }),
);
