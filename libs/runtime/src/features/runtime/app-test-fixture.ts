import { APPLICATION, stripeEnvKey } from "@repo/config";
import { env } from "cloudflare:workers";
import { Layer } from "effect";
import { TestClock } from "effect/testing";

import { appLayer } from "./bindings.ts";
import { FileStore } from "./file-store.ts";
import { workerRuntime, type WorkerRuntime } from "./worker-runtime.ts";

import type { AppServices } from "./index.ts";
const fixtureOrigin = "http://localhost:3001";
const fixtureAuthSecret = "worker-test-secret-at-least-32-characters";
const appEnvironment = (
  overrides: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> => {
  return {
    ...env,
    APP_ORIGIN: fixtureOrigin,
    APP_RELEASE: "test",
    ASSETS: { fetch: (): Promise<Response> => Promise.resolve(new Response(undefined)) },
    AUTH_SECRET: fixtureAuthSecret,
    EMAIL_FROM: "sender@example.test",
    OPS_EMAIL: "ops@example.test",
    [stripeEnvKey.meteredPriceId]: "price_TestMetered",
    [stripeEnvKey.priceId]: "price_TestMonthly",
    [stripeEnvKey.secretKey]: "sk_test_placeholder",
    [stripeEnvKey.webhookSecret]: "whsec_testsecret",
    ...overrides,
  };
};
const testClockRuntime = (
  routes: Readonly<Record<string, string>>,
): WorkerRuntime<AppServices | TestClock.TestClock, never> => {
  const services = Layer.orDie(
    appLayer({ env: appEnvironment(), audience: APPLICATION.user, routes }),
  );
  return workerRuntime(() => Layer.merge(services, TestClock.layer()));
};
const testFileStore = Layer.orDie(FileStore.fromEnvironment(env));
export { appEnvironment, fixtureAuthSecret, fixtureOrigin, testClockRuntime, testFileStore };
