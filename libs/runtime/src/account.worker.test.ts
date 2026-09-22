import { assert, describe, it } from "@effect/vitest";
import { TestDatabase, runStatement } from "@repo/db/testing";
import { httpStatus } from "@repo/config";

import { recordingSink } from "@repo/observability/testing";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { sessionApi } from "./account.ts";
import { fixtureOrigin, testClockRuntime } from "./app-fixture.ts";
import { apiRoot, apiRoutes, createApi } from "./http.ts";

const routes = { "/api/health": "health" };
const reporting = { log: recordingSink().sink, service: "service-member" } as const;
const migrated = Effect.orDie(Effect.provide(runStatement("select 1"), TestDatabase));
const broken = Effect.orDie(runStatement("drop table `user`"));

interface Isolate {
  readonly askHealth: Effect.Effect<number>;
  readonly passCacheWindow: Effect.Effect<void>;
  readonly stop: Effect.Effect<void>;
}

function startIsolate(): Isolate {
  const runtime = testClockRuntime(routes);
  const app = createApi(apiRoot).use(sessionApi(apiRoutes(runtime, reporting)));
  return {
    askHealth: Effect.promise(() =>
      Promise.resolve(app.fetch(new Request(`${fixtureOrigin}${apiRoot}/health`))).then(
        (response) => response.status,
      ),
    ),
    passCacheWindow: Effect.promise(() => runtime.runPromise(TestClock.adjust("1 minute"))),
    stop: Effect.promise(() => runtime.dispose()),
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

  it.effect("repeats a broken database without reading it again", () =>
    Effect.gen(function* program() {
      yield* migrated;
      yield* broken;
      const isolate = startIsolate();
      assert.strictEqual(yield* isolate.askHealth, httpStatus.internalServerError);
      yield* migrated;
      assert.strictEqual(yield* isolate.askHealth, httpStatus.internalServerError);
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
});
