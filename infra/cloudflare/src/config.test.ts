import { assert, it } from "@effect/vitest";
import { ConfigurationInvalid, readAi, readConfig } from "@repo/config";
import { readStorage } from "@repo/config/storage";
import { otlpSignalUrl } from "@repo/observability";
import { Effect } from "effect";

import { parseDeploymentCommand, traceDestination, workerObservability } from "./config.ts";
import { stackNames } from "./stacks.ts";
import { verificationSettings } from "./verification-fixture.ts";

import type {
  Ai,
  D1Database,
  DurableObjectNamespace,
  Fetcher,
  KVNamespace,
  R2Bucket,
  SendEmail,
  Service,
} from "@cloudflare/workers-types";
import type { Flagship } from "alchemy/Cloudflare";
import type { AppBindings } from "./bindings.ts";

const release = "0".repeat(16);
const settings = verificationSettings;

function binding<Binding>(value: object): Binding {
  return value as Binding;
}

const sharedBindings = {
  APP_ORIGIN: settings.origins["service-admin"],
  APP_RELEASE: release,
  ASSETS: binding<Service>({ fetch: (): Promise<Response> => Promise.resolve(new Response()) }),
  AUTH_SECRET: "runtime-secret-of-at-least-32-characters",
  CORE: binding<Fetcher>({ fetch: (): Promise<Response> => Promise.resolve(new Response()) }),
  DB: binding<D1Database>({
    batch: (): Promise<never[]> => Promise.resolve([]),
    prepare: (): undefined => undefined,
  }),
  EMAIL: binding<SendEmail>({ send: (): Promise<undefined> => Promise.resolve(undefined) }),
  EMAIL_FROM: settings.mailFrom,
  FLAGSHIP_ACCOUNT_ID: settings.accountId,
  FLAGS: binding<Flagship.App>({
    appId: "flagship-app-id",
    getBooleanValue: (): Promise<boolean> => Promise.resolve(false),
    getNumberValue: (): Promise<number> => Promise.resolve(0),
    getObjectValue: (): Promise<object> => Promise.resolve({}),
    getStringValue: (): Promise<string> => Promise.resolve(""),
  }),
  OPS_EMAIL: settings.budget.recipients[0] ?? settings.mailFrom,
};

const adminBindings: AppBindings<"service-admin"> = sharedBindings;
const userBindings: AppBindings<"service-member"> = {
  ...sharedBindings,
  AI: binding<Ai>({ run: (): Promise<{ data: never[] }> => Promise.resolve({ data: [] }) }),
  APP_ORIGIN: settings.origins["service-member"],
  CACHE: binding<KVNamespace>({
    delete: (): Promise<undefined> => Promise.resolve(undefined),
    get: (): Promise<null> => Promise.resolve(null),
    put: (): Promise<undefined> => Promise.resolve(undefined),
  }),
  FILES: binding<R2Bucket>({
    delete: (): Promise<undefined> => Promise.resolve(undefined),
    get: (): Promise<null> => Promise.resolve(null),
    put: (): Promise<null> => Promise.resolve(null),
  }),
  JOBS: binding({ send: (): Promise<undefined> => Promise.resolve(undefined) }),
  PROCESS: binding({
    create: (): Promise<{ id: string }> => Promise.resolve({ id: "job" }),
    get: (): Promise<{ status: () => Promise<{ status: string }> }> =>
      Promise.resolve({
        status: (): Promise<{ status: string }> => Promise.resolve({ status: "complete" }),
      }),
  }),
  STRIPE_PRICE_ID: "price_test",
  STRIPE_SECRET_KEY: "sk_test_secret_of_at_least_32_characters",
  STRIPE_WEBHOOK_SECRET: "whsec_test_secret_of_at_least_32_ch",
  USER_INBOX: binding<DurableObjectNamespace>({
    get: (): undefined => undefined,
    idFromName: (): undefined => undefined,
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
    assert.isUndefined((yield* readStorage(adminBindings)).files);
    assert.isUndefined((yield* readStorage(adminBindings)).cache);
    assert.isDefined((yield* readStorage(userBindings)).files);
    assert.isDefined((yield* readStorage(userBindings)).cache);
    const missing = yield* readConfig({ ...userBindings, DB: undefined }).pipe(Effect.flip);
    assert.instanceOf(missing, ConfigurationInvalid);
  }),
);
