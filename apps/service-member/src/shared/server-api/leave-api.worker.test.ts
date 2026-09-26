import { assert, it } from "@effect/vitest";
import { APPLICATION, httpStatus } from "@repo/config";
import { TestDatabase, runStatement } from "@repo/db/testing";
import { recordingSink } from "@repo/observability/testing";
import { appLayer } from "@repo/runtime/bindings";
import { apiRoot, apiRoutes, createApi } from "@repo/runtime/http";
import { appEnvironment, fixtureOrigin } from "@repo/runtime/testing";
import { workerRuntime } from "@repo/runtime/worker";
import { Effect, Layer } from "effect";

import { leaveApi } from "./leave-api.ts";
import { memberRequirementLayer } from "./member-requirement-layer.ts";

const routes = {
  "/api/recovery/accept": "recovery-accept-api",
  "/api/recovery/decline": "recovery-decline-api",
  "/api/recovery-offer": "recovery-offer-api",
};
const reporting = { log: recordingSink().sink, service: APPLICATION.serviceMember } as const;
const migrated = Effect.orDie(Effect.provide(runStatement("select 1"), TestDatabase));

function leaveApp() {
  const environment = appEnvironment({});
  const runtime = workerRuntime(() => {
    const base = Layer.orDie(appLayer({ audience: APPLICATION.serviceMember, env: environment, routes }));
    return Layer.merge(
      base,
      Layer.orDie(memberRequirementLayer(environment)).pipe(Layer.provide(base)),
    );
  });
  return createApi(apiRoot).use(leaveApi(apiRoutes(runtime, reporting)));
}

function postRecoveryAccept(app: ReturnType<typeof leaveApp>): Effect.Effect<Response> {
  return Effect.promise(() =>
    Promise.resolve(
      app.fetch(
        new Request(`${fixtureOrigin}${apiRoot}/recovery/accept`, {
          body: "{}",
          headers: { "content-type": "application/json", origin: fixtureOrigin },
          method: "POST",
        }),
      ),
    ),
  );
}

it.effect("rejects unauthenticated recovery acceptance", () =>
  Effect.gen(function* program() {
    yield* migrated;
    const app = leaveApp();
    const response = yield* postRecoveryAccept(app);
    assert.strictEqual(response.status, httpStatus.unauthorized);
  }),
);
