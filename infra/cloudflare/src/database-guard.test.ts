import { HttpResponse, http } from "msw";
import { assert, it } from "@effect/vitest";
import { describeCause, describeFailure } from "./secrets.ts";
import type { CreatedResourceState } from "alchemy/State/ResourceState";
import { Effect } from "effect";
import { InMemoryService } from "alchemy/State";
import type { StateService } from "alchemy/State";
import { assertDatabaseUnclaimed } from "./database-guard.ts";
import { mockServer } from "./account-fixture.ts";
import { stackName } from "./stacks.ts";
import { verificationSettings } from "./verification-fixture.ts";

const target = { accountId: verificationSettings.accountId, prefix: verificationSettings.prefix };
const access = { accountId: target.accountId, apiToken: "guard-test-not-a-real-token" };
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${target.accountId}/d1/database`;
const databaseName = `${target.prefix}-db`;
const databaseId = "22222222-2222-4222-8222-222222222222";
const otherDatabaseId = "11111111-2222-3333-4444-555555555555";

function storedDatabase(uuid: string): CreatedResourceState {
  return {
    attr: { databaseId: uuid, databaseName },
    bindings: [],
    downstream: [],
    fqn: "Database",
    instanceId: "instance",
    logicalId: "Database",
    namespace: undefined,
    props: { name: databaseName },
    providerVersion: 1,
    resourceType: "Cloudflare.D1Database",
    status: "created",
  };
}

function store(uuid?: string): Effect.Effect<StateService> {
  return InMemoryService(
    uuid === undefined
      ? {}
      : { [stackName("database")]: { [target.prefix]: { Database: storedDatabase(uuid) } } },
  );
}

const unusedName = http.get(endpoint, () => HttpResponse.json({ result: [], success: true }));
const takenName = http.get(endpoint, () =>
  HttpResponse.json({ result: [{ name: databaseName, uuid: databaseId }], success: true }),
);

it.effect("lets a first deploy through without reaching for the state store", () =>
  Effect.gen(function* program() {
    yield* mockServer(unusedName);
    assert.isUndefined(
      yield* assertDatabaseUnclaimed(
        access,
        target,
        Effect.die("the state store must not be consulted when the name is free"),
      ),
    );
  }).pipe(Effect.scoped),
);

it.effect("lets a repeat deploy through when state records the database it just found", () =>
  Effect.gen(function* program() {
    yield* mockServer(takenName);
    assert.isUndefined(yield* assertDatabaseUnclaimed(access, target, store(databaseId)));
  }).pipe(Effect.scoped),
);

it.effect("stops when the name resolves to a database this stage never created", () =>
  Effect.gen(function* program() {
    yield* mockServer(takenName);
    for (const recorded of [store(), store(otherDatabaseId)]) {
      const failure = yield* assertDatabaseUnclaimed(access, target, recorded).pipe(Effect.flip);
      assert.deepStrictEqual(describeFailure(failure, []), {
        code: "database_name_taken",
        keys: ["TEMPLATE_PREFIX"],
      });
    }
  }).pipe(Effect.scoped),
);

it.effect("stops instead of guessing when the state store cannot be read", () =>
  Effect.gen(function* program() {
    yield* mockServer(takenName);
    const outcome = yield* assertDatabaseUnclaimed(
      access,
      target,
      Effect.fail({ _tag: "StateStoreUnreachable" } as const),
    ).pipe(Effect.exit);
    assert.isTrue(outcome._tag === "Failure");
  }).pipe(Effect.scoped),
);

it.effect("reports a taken name as a failed run rather than continuing", () =>
  Effect.gen(function* program() {
    yield* mockServer(takenName);
    const cause = yield* assertDatabaseUnclaimed(access, target, store()).pipe(
      Effect.sandbox,
      Effect.flip,
    );
    assert.deepStrictEqual(describeCause(cause, []), {
      code: "database_name_taken",
      keys: ["TEMPLATE_PREFIX"],
    });
  }).pipe(Effect.scoped),
);
