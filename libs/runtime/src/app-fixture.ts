import { APPLICATION } from "@repo/config";
import { env } from "cloudflare:workers";
import { Layer } from "effect";
import { TestClock } from "effect/testing";

import { appLayer } from "./bindings.ts";
import { workerRuntime } from "./worker-runtime.ts";

import type { AppServices } from "./index.ts";
import type { WorkerRuntime } from "./worker-runtime.ts";

const fixtureOrigin = "http://localhost:3001";
const fixtureAuthSecret = "worker-test-secret-at-least-32-characters";

function appEnvironment(
  overrides: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    ...env,
    APP_ORIGIN: fixtureOrigin,
    APP_RELEASE: "test",
    ASSETS: { fetch: (): Promise<Response> => Promise.resolve(new Response(undefined)) },
    AUTH_SECRET: fixtureAuthSecret,
    EMAIL_FROM: "sender@example.test",
    OPS_EMAIL: "ops@example.test",
    STRIPE_PRICE_ID: "price_TestMonthly",
    STRIPE_SECRET_KEY: "sk_test_placeholder",
    STRIPE_WEBHOOK_SECRET: "whsec_testsecret",
    ...overrides,
  };
}

function testClockRuntime(
  routes: Readonly<Record<string, string>>,
): WorkerRuntime<AppServices | TestClock.TestClock, never> {
  const services = Layer.orDie(appLayer(appEnvironment(), APPLICATION.user, routes));
  return workerRuntime(() => Layer.merge(services, TestClock.layer()));
}

export { appEnvironment, fixtureAuthSecret, fixtureOrigin, testClockRuntime };
