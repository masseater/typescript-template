import { env } from "cloudflare:workers";
import { Layer } from "effect";
import { TestClock } from "effect/testing";

import { appLayer } from "./index.ts";
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
    ASSETS: { fetch: async (): Promise<Response> => new Response(undefined) },
    AUTH_SECRET: fixtureAuthSecret,
    EMAIL_FROM: "sender@example.test",
    ...overrides,
  };
}

function testClockRuntime(
  routes: Readonly<Record<string, string>>,
): WorkerRuntime<AppServices | TestClock.TestClock, never> {
  const services = Layer.orDie(appLayer(appEnvironment(), "user", routes));
  return workerRuntime(() => Layer.merge(services, TestClock.layer()));
}

export { appEnvironment, fixtureAuthSecret, fixtureOrigin, testClockRuntime };
