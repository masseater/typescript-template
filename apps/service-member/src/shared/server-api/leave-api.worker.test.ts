import { assert, it } from "@effect/vitest";
import { APPLICATION } from "@repo/config";
import { TestDatabase, runStatement } from "@repo/db/testing";
import { httpStatus } from "@repo/observability";
import { recordingSink } from "@repo/observability/testing";
import { appLayer, readWorkerConfig } from "@repo/runtime/bindings";
import { apiRoot, apiRoutes, createApi } from "@repo/runtime/http";
import { appEnvironment, fixtureOrigin } from "@repo/runtime/testing";
import { workerRuntime } from "@repo/runtime/worker";
import { Effect, Layer } from "effect";

import { leaveApi } from "./leave-api.ts";
import { opsMailLayer } from "./ops-mail.ts";

const routes = {
  "/api/recovery/accept": "recovery-accept-api",
  "/api/recovery/decline": "recovery-decline-api",
  "/api/recovery-offer": "recovery-offer-api",
};
const reporting = { log: recordingSink().sink, service: APPLICATION.user } as const;
const migrated = Effect.orDie(Effect.provide(runStatement("select 1"), TestDatabase));

function leaveApp() {
  const environment = appEnvironment({});
  const runtime = workerRuntime(() =>
    Layer.merge(
      Layer.orDie(appLayer(environment, APPLICATION.user, routes)),
      Layer.unwrap(readWorkerConfig(environment).pipe(Effect.map(opsMailLayer), Effect.orDie)),
    ),
  );
  return createApi(apiRoot).use(leaveApi(apiRoutes(runtime, reporting)));
}

async function postRecoveryAccept(app: ReturnType<typeof leaveApp>): Promise<Response> {
  return app.fetch(
    new Request(`${fixtureOrigin}${apiRoot}/recovery/accept`, {
      headers: { "content-type": "application/json", origin: fixtureOrigin },
      method: "POST",
    }),
  );
}

it.effect("rejects unauthenticated recovery acceptance", () =>
  Effect.gen(function* program() {
    yield* migrated;
    const app = leaveApp();
    const response = yield* Effect.promise(async () => postRecoveryAccept(app));
    assert.strictEqual(response.status, httpStatus.unauthorized);
  }),
);
