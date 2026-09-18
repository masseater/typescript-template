import { assert, describe, it } from "@effect/vitest";
import { env } from "cloudflare:workers";
import { Effect, Layer, ManagedRuntime } from "effect";
import { TestClock } from "effect/testing";

import { TestDatabase, runStatement } from "@repo/db/testing";
import { httpStatus } from "@repo/observability";
import { recordingSink } from "@repo/observability/testing";

import { sessionApi } from "./account.ts";
import { apiRoot, apiRoutes, createApi } from "./http.ts";
import { appLayer } from "./index.ts";

const origin = "http://localhost:3001";
const routes = { "/api/health": "health" };
const reporting = { log: recordingSink().sink, service: "user" } as const;
const migrated = Effect.orDie(Effect.provide(runStatement("select 1"), TestDatabase));
const broken = Effect.orDie(runStatement("drop table `user`"));

interface Isolate {
  readonly askHealth: Effect.Effect<number>;
  readonly passCacheWindow: Effect.Effect<void>;
  readonly stop: Effect.Effect<void>;
}

function environment(): Record<string, unknown> {
  return {
    ...env,
    APP_ORIGIN: origin,
    APP_RELEASE: "test",
    ASSETS: { fetch: async (): Promise<Response> => new Response(undefined) },
    AUTH_SECRET: "account-test-secret-at-least-32-characters",
    EMAIL_FROM: "sender@example.test",
  };
}

function startIsolate(): Isolate {
  const services = Layer.orDie(appLayer(environment(), "user", routes));
  const runtime = ManagedRuntime.make(Layer.merge(services, TestClock.layer()));
  const app = createApi(apiRoot).use(sessionApi(apiRoutes(runtime, reporting)));
  return {
    askHealth: Effect.promise(async () => {
      const response = await app.fetch(new Request(`${origin}${apiRoot}/health`));
      return response.status;
    }),
    passCacheWindow: Effect.promise(async () => runtime.runPromise(TestClock.adjust("1 minute"))),
    stop: Effect.promise(async () => runtime.dispose()),
  };
}

describe("the health route", () => {
  it.effect("answers a repeated call without reading the database again", () =>
    Effect.gen(function* program() {
      yield* migrated;
      const isolate = startIsolate();
      assert.strictEqual(yield* isolate.askHealth, httpStatus.ok);
      yield* broken;
      assert.strictEqual(yield* isolate.askHealth, httpStatus.ok);
      yield* isolate.stop;
    }),
  );

  it.effect("reads the database again once the cache window has passed", () =>
    Effect.gen(function* program() {
      yield* migrated;
      const isolate = startIsolate();
      assert.strictEqual(yield* isolate.askHealth, httpStatus.ok);
      yield* broken;
      yield* isolate.passCacheWindow;
      assert.strictEqual(yield* isolate.askHealth, httpStatus.internalServerError);
      yield* isolate.stop;
    }),
  );

  it.effect("reports the broken database to an isolate that has cached nothing", () =>
    Effect.gen(function* program() {
      yield* migrated;
      yield* broken;
      const isolate = startIsolate();
      assert.strictEqual(yield* isolate.askHealth, httpStatus.internalServerError);
      yield* isolate.stop;
    }),
  );
});
