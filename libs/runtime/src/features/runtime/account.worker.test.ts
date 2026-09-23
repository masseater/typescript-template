import { httpStatus } from "@repo/config";
import { TestDatabase, runStatement } from "@repo/db/testing";
import { recordingSink } from "@repo/observability/testing";
import { Effect } from "effect";
import { TestClock } from "effect/testing";
import { describe, expect, test } from "vite-plus/test";

import { sessionApi } from "./account.ts";
import { fixtureOrigin, testClockRuntime } from "./app-fixture.ts";
import { apiRoot, apiRoutes, createApi, elysiaServer } from "./http.ts";

describe("the health route", () => {
  describe("asked twice while the database breaks in between", () => {
    const it = test.extend("healthStatuses", ({}, { onCleanup }) =>
      Effect.runPromise(
        Effect.gen(function* healthStatusesProgram() {
          yield* Effect.orDie(Effect.provide(runStatement("select 1"), TestDatabase));
          const runtime = testClockRuntime({ "/api/health": "health" });
          onCleanup(() => runtime.dispose());
          const { ANY: serveRequest } = elysiaServer(
            createApi(apiRoot).use(
              sessionApi(
                apiRoutes(runtime, { log: recordingSink().sink, service: "service-member" }),
              ),
            ),
          ).handlers;
          const firstAnswer = yield* Effect.promise(() =>
            serveRequest({ request: new Request(`${fixtureOrigin}${apiRoot}/health`) }),
          );
          yield* Effect.orDie(runStatement("drop table `user`"));
          const secondAnswer = yield* Effect.promise(() =>
            serveRequest({ request: new Request(`${fixtureOrigin}${apiRoot}/health`) }),
          );
          return [firstAnswer.status, secondAnswer.status];
        }),
      ));

    it("answers the repeated call without reading the database again", ({ healthStatuses }) => {
      expect(healthStatuses).toStrictEqual([httpStatus.ok, httpStatus.ok]);
    });
  });

  describe("asked twice while the database is repaired in between", () => {
    const it = test.extend("healthStatuses", ({}, { onCleanup }) =>
      Effect.runPromise(
        Effect.gen(function* healthStatusesProgram() {
          yield* Effect.orDie(Effect.provide(runStatement("select 1"), TestDatabase));
          yield* Effect.orDie(runStatement("drop table `user`"));
          const runtime = testClockRuntime({ "/api/health": "health" });
          onCleanup(() => runtime.dispose());
          const { ANY: serveRequest } = elysiaServer(
            createApi(apiRoot).use(
              sessionApi(
                apiRoutes(runtime, { log: recordingSink().sink, service: "service-member" }),
              ),
            ),
          ).handlers;
          const firstAnswer = yield* Effect.promise(() =>
            serveRequest({ request: new Request(`${fixtureOrigin}${apiRoot}/health`) }),
          );
          yield* Effect.orDie(Effect.provide(runStatement("select 1"), TestDatabase));
          const secondAnswer = yield* Effect.promise(() =>
            serveRequest({ request: new Request(`${fixtureOrigin}${apiRoot}/health`) }),
          );
          return [firstAnswer.status, secondAnswer.status];
        }),
      ));

    it("repeats the broken answer without reading the database again", ({ healthStatuses }) => {
      expect(healthStatuses).toStrictEqual([
        httpStatus.internalServerError,
        httpStatus.internalServerError,
      ]);
    });
  });

  describe("asked again once the cache window has passed", () => {
    const it = test.extend("healthStatuses", ({}, { onCleanup }) =>
      Effect.runPromise(
        Effect.gen(function* healthStatusesProgram() {
          yield* Effect.orDie(Effect.provide(runStatement("select 1"), TestDatabase));
          const runtime = testClockRuntime({ "/api/health": "health" });
          onCleanup(() => runtime.dispose());
          const { ANY: serveRequest } = elysiaServer(
            createApi(apiRoot).use(
              sessionApi(
                apiRoutes(runtime, { log: recordingSink().sink, service: "service-member" }),
              ),
            ),
          ).handlers;
          const firstAnswer = yield* Effect.promise(() =>
            serveRequest({ request: new Request(`${fixtureOrigin}${apiRoot}/health`) }),
          );
          yield* Effect.orDie(runStatement("drop table `user`"));
          yield* Effect.promise(() => runtime.runPromise(TestClock.adjust("1 minute")));
          const secondAnswer = yield* Effect.promise(() =>
            serveRequest({ request: new Request(`${fixtureOrigin}${apiRoot}/health`) }),
          );
          return [firstAnswer.status, secondAnswer.status];
        }),
      ));

    it("reads the database again", ({ healthStatuses }) => {
      expect(healthStatuses).toStrictEqual([httpStatus.ok, httpStatus.internalServerError]);
    });
  });
});
