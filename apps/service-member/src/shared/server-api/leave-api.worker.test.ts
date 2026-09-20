import { assert, it } from "@effect/vitest";
import { APPLICATION, readConfig } from "@repo/config";
import { ROLE } from "@repo/config";
import { query, schema, withdrawMember } from "@repo/db";
import { runStatement, TestDatabase } from "@repo/db/testing";
import { httpStatus } from "@repo/observability";
import { recordingSink } from "@repo/observability/testing";
import { appLayer } from "@repo/runtime";
import { apiRoot, apiRoutes, createApi } from "@repo/runtime/http";
import { appEnvironment, fixtureOrigin } from "@repo/runtime/testing";
import { workerRuntime } from "@repo/runtime/worker";
import { Effect, Layer } from "effect";

import { leaveApi } from "./leave-api.ts";
import { opsMailLayer } from "./ops-mail.ts";

const routes = { "/api/leave": "leave-api", "/api/recover": "recover-api" };
const reporting = { log: recordingSink().sink, service: APPLICATION.user } as const;
const { user } = schema;
const migrated = Effect.orDie(Effect.provide(runStatement("select 1"), TestDatabase));

const addUser = (userId: string) =>
  query(async (database): Promise<void> => {
    await database.insert(user).values({
      createdAt: new Date(),
      email: `${userId}@example.com`,
      emailVerified: true,
      id: userId,
      name: userId,
      profile: "",
      role: ROLE.member,
      socialLinks: [],
      updatedAt: new Date(),
    });
  });

function leaveApp() {
  const environment = appEnvironment({});
  const runtime = workerRuntime(() =>
    Layer.merge(
      Layer.orDie(appLayer(environment, APPLICATION.user, routes)),
      Layer.unwrap(readConfig(environment).pipe(Effect.map(opsMailLayer), Effect.orDie)),
    ),
  );
  return createApi(apiRoot).use(leaveApi(apiRoutes(runtime, reporting)));
}

async function postRecover(app: ReturnType<typeof leaveApp>, email: string): Promise<Response> {
  return app.fetch(
    new Request(`${fixtureOrigin}${apiRoot}/recover`, {
      body: JSON.stringify({ email }),
      headers: { "content-type": "application/json", origin: fixtureOrigin },
      method: "POST",
    }),
  );
}

it.effect("restores a withdrawn member through the recover API", () =>
  Effect.gen(function* program() {
    yield* migrated;
    yield* addUser("returning");
    yield* withdrawMember("returning", { immediate: false });
    const app = leaveApp();
    const response = yield* Effect.promise(async () => postRecover(app, "returning@example.com"));
    assert.strictEqual(response.status, httpStatus.ok);
  }).pipe(Effect.provide(TestDatabase)),
);
