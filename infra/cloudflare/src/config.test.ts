import { assert, it } from "@effect/vitest";
import { ConfigurationInvalid, readAi, readConfig } from "@repo/config";
import { readStorage } from "@repo/config/storage";
import { otlpSignalUrl } from "@repo/observability";
import { Effect } from "effect";

import { parseDeploymentCommand, traceDestination, workerObservability } from "./config.ts";
import { stackNames } from "./stacks.ts";
import { verificationSettings } from "./verification-fixture.ts";

import type { Ai, D1Database, R2Bucket, SendEmail, Service } from "@cloudflare/workers-types";
import type { AppBindings } from "./bindings.ts";

const release = "0".repeat(16);
const settings = verificationSettings;

// oxlint-disable-next-line typescript/no-unnecessary-type-parameters
function binding<Binding>(value: object): Binding {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return value as Binding;
}

const sharedBindings = {
  APP_ORIGIN: settings.origins["service-admin"],
  APP_RELEASE: release,
  ASSETS: binding<Service>({ fetch: async (): Promise<Response> => new Response() }),
  AUTH_SECRET: "runtime-secret-of-at-least-32-characters",
  DB: binding<D1Database>({
    batch: async (): Promise<never[]> => [],
    prepare: (): undefined => undefined,
  }),
  EMAIL: binding<SendEmail>({ send: async (): Promise<undefined> => undefined }),
  EMAIL_FROM: settings.mailFrom,
  OPS_EMAIL: settings.budget.recipients[0] ?? settings.mailFrom,
};

const adminBindings: AppBindings<"service-admin"> = sharedBindings;
const userBindings: AppBindings<"service-member"> = {
  ...sharedBindings,
  AI: binding<Ai>({ run: async (): Promise<{ data: never[] }> => ({ data: [] }) }),
  APP_ORIGIN: settings.origins["service-member"],
  PHOTOS: binding<R2Bucket>({
    delete: async (): Promise<undefined> => undefined,
    get: async (): Promise<null> => null,
    put: async (): Promise<null> => null,
  }),
};

const confirmation = "0".repeat(16);

it.effect(
  "deployment commands reject ignored arguments instead of selecting an unintended stack",
  () =>
    Effect.gen(function* program() {
      assert.deepStrictEqual(yield* parseDeploymentCommand(["plan", "service-admin"]), {
        operation: "plan",
        stacks: ["service-admin"],
      });
      assert.deepStrictEqual(yield* parseDeploymentCommand(["plan", "all"]), {
        operation: "plan",
        stacks: [...stackNames],
      });
      assert.deepStrictEqual(
        yield* parseDeploymentCommand(["deploy", "service-member", "--confirm-plan", confirmation]),
        { confirmation, operation: "deploy", stack: "service-member" },
      );
      assert.deepStrictEqual(yield* parseDeploymentCommand(["deploy", "all"]), {
        operation: "deploy-all",
        stacks: [...stackNames],
      });
      for (const args of [
        ["deploy", "service-member"],
        ["deploy", "all", "--confirm-plan", confirmation],
        ["deploy", "service-member", "--confirm-plan", confirmation, "--stage", "other"],
        ["deploy", "service-member", "--confirm-plan", "not-a-confirmation"],
        ["deploy", "service-member", "--yes"],
        ["deploy", "unknown", "--confirm-plan", confirmation],
        ["plan", "all", "--confirm-plan", confirmation],
        ["up", "all"],
      ]) {
        const failure = yield* parseDeploymentCommand(args).pipe(Effect.flip);
        assert.strictEqual(failure.code, "deployment_command_invalid");
      }
    }),
);

it.effect("a Worker without an OTLP endpoint declares no trace destination", () =>
  Effect.sync(() => {
    assert.deepStrictEqual(workerObservability({ ...settings, otlp: undefined }).traces, {
      enabled: true,
      headSamplingRate: settings.observabilitySampling,
    });
    assert.isUndefined(traceDestination({ ...settings, otlp: undefined }));
  }),
);

it.effect("the destination and the Worker derive their signal URLs from one base URL", () =>
  Effect.sync(() => {
    for (const base of [settings.otlp.endpoint, `${settings.otlp.endpoint}/`]) {
      assert.deepStrictEqual(
        traceDestination({ ...settings, otlp: { ...settings.otlp, endpoint: base } }),
        {
          enabled: true,
          name: `${settings.prefix}-traces`,
          url: "https://otlp.example.com/v1/traces",
        },
      );
      assert.strictEqual(otlpSignalUrl(base, "traces"), "https://otlp.example.com/v1/traces");
      assert.strictEqual(otlpSignalUrl(base, "logs"), "https://otlp.example.com/v1/logs");
    }
  }),
);

it.effect("a disabled OTLP destination keeps the Worker declaration and the resource", () =>
  Effect.sync(() => {
    const disabled = { ...settings, otlp: { ...settings.otlp, enabled: false } };
    assert.deepStrictEqual(traceDestination(disabled)?.enabled, false);
    assert.deepStrictEqual(workerObservability(disabled).traces, {
      destinations: [`${settings.prefix}-traces`],
      enabled: true,
      headSamplingRate: settings.observabilitySampling,
      persist: true,
    });
  }),
);

it.effect("every application reads exactly the bindings its Worker declares", () =>
  Effect.gen(function* program() {
    const admin = yield* readConfig(adminBindings);
    assert.strictEqual(admin.APP_ORIGIN, settings.origins["service-admin"]);
    assert.strictEqual(admin.APP_RELEASE, release);
    assert.isUndefined(yield* readAi(adminBindings));
    assert.isDefined(yield* readAi(userBindings));
    assert.isUndefined(yield* readStorage(adminBindings));
    assert.isDefined(yield* readStorage(userBindings));
    const missing = yield* readConfig({ ...userBindings, DB: undefined }).pipe(Effect.flip);
    assert.instanceOf(missing, ConfigurationInvalid);
  }),
);
