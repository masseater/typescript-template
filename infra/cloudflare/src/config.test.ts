import type { Ai, D1Database, SendEmail, Service } from "@cloudflare/workers-types";
import type { AppBindings, WikiBindings } from "./bindings.ts";
import { ConfigurationInvalid, readConfig, readWikiConfig } from "@template/config";
import { assert, it } from "@effect/vitest";
import {
  parseDeploymentCommand,
  parseSharedConfig,
  validateAuthSecret,
  workerSubdomain,
} from "./config.ts";
import { Effect } from "effect";
import { applyPlan } from "./stacks.ts";
import { verificationSettings } from "./verification-fixture.ts";

const AUTH_SECRET_LENGTH = 32;

const authSecret = "x".repeat(AUTH_SECRET_LENGTH);
const release = "0123456789abcdef";
const settings = verificationSettings;

// oxlint-disable-next-line typescript/no-unnecessary-type-parameters
function binding<Binding>(value: object): Binding {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return value as Binding;
}

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
      assert.deepStrictEqual(yield* parseDeploymentCommand(["plan", "admin"]), {
        operation: "plan",
        targets: [{ dependencies: ["database"], stack: "admin" }],
      });
      assert.strictEqual(
        yield* code(parseDeploymentCommand(["deploy", "user", "--stage", "other"])),
        "deployment_command_invalid",
      );
      assert.deepStrictEqual(
        (yield* parseDeploymentCommand(["deploy", "wiki"])).targets.map(({ stack }) => stack),
        ["wiki"],
      );
      assert.deepStrictEqual(
        (yield* parseDeploymentCommand(["deploy", "all"])).targets,
        yield* applyPlan(),
      );
      assert.strictEqual(
        yield* code(parseDeploymentCommand(["deploy", "unknown"])),
        "deployment_command_invalid",
      );
      assert.strictEqual(
        yield* code(parseDeploymentCommand(["up", "all"])),
        "deployment_command_invalid",
      );
    }),
);

it.effect("workers disable every alternative public URL", () =>
  Effect.sync(() => {
    assert.deepStrictEqual(workerSubdomain, { enabled: false, previewsEnabled: false });
  }),
);

const appBindings: AppBindings = {
  APP_ORIGIN: settings.origins.user,
  APP_RELEASE: release,
  ASSETS: binding<Service>({ fetch: async (): Promise<Response> => new Response() }),
  AUTH_SECRET: "user-runtime-secret-at-least-32-characters",
  DB: binding<D1Database>({
    batch: async (): Promise<never[]> => [],
    prepare: (): undefined => undefined,
  }),
  EMAIL: binding<SendEmail>({ send: async (): Promise<undefined> => undefined }),
  EMAIL_FROM: settings.mailFrom,
};

const wikiBindings: WikiBindings = {
  ...appBindings,
  AI: binding<Ai>({ run: async (): Promise<{ data: never[] }> => ({ data: [] }) }),
  APP_ORIGIN: settings.origins.wiki,
};

it.effect("every application reads exactly the bindings its Worker declares", () =>
  Effect.gen(function* program() {
    const app = yield* readConfig(appBindings);
    assert.strictEqual(app.APP_ORIGIN, settings.origins.user);
    assert.strictEqual(app.APP_RELEASE, release);
    const wiki = yield* readWikiConfig(wikiBindings);
    assert.strictEqual(wiki.APP_ORIGIN, settings.origins.wiki);
    assert.isDefined(wiki.AI);
    assert.isUndefined((yield* readWikiConfig(appBindings)).AI);
    const missing = yield* readWikiConfig({ ...wikiBindings, DB: undefined }).pipe(Effect.flip);
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

it.effect("secret validation errors do not include their inputs", () =>
  Effect.gen(function* program() {
    const failure = yield* validateAuthSecret("private-value").pipe(Effect.flip);
    assert.strictEqual(failure.code, "auth_secret_invalid");
    assert.notInclude(JSON.stringify(failure), "private-value");
    assert.notInclude(String(failure), "private-value");
    assert.strictEqual(yield* validateAuthSecret(authSecret), authSecret);
  }),
);
