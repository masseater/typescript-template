import { assert, it } from "@effect/vitest";
import { Effect } from "effect";

import { mockServer } from "./account-fixture.ts";
import {
  access,
  accountHandlers,
  config,
  databaseId,
  emptyState,
  sendingRecords,
} from "./inspection-fixture.ts";
import { describeFailure } from "./secrets.ts";
import { assertStackUnclaimed } from "./stack-guards.ts";
import { sendingStacks } from "./stacks.ts";

const deployment = { access, config };

it.effect("stops the onboarding unit on an account that already holds the sending domain", () =>
  Effect.gen(function* program() {
    yield* mockServer(...accountHandlers({ records: sendingRecords }));
    const failure = yield* assertStackUnclaimed("email", deployment, emptyState()).pipe(
      Effect.flip,
    );
    assert.deepStrictEqual(describeFailure(failure, []), {
      code: "sending_domain_unavailable",
      keys: ["emailSending"],
    });
  }).pipe(Effect.scoped),
);

it.effect("stops the database unit on a name another project created", () =>
  Effect.gen(function* program() {
    yield* mockServer(
      ...accountHandlers({ databases: [{ name: `${config.prefix}-db`, uuid: databaseId }] }),
    );
    const failure = yield* assertStackUnclaimed("database", deployment, emptyState()).pipe(
      Effect.flip,
    );
    assert.deepStrictEqual(describeFailure(failure, []), {
      code: "database_name_taken",
      keys: ["TEMPLATE_PREFIX"],
    });
  }).pipe(Effect.scoped),
);

it.effect("reads nothing for the units that claim no account-wide name", () =>
  Effect.forEach(sendingStacks, (stack) =>
    assertStackUnclaimed(
      stack,
      deployment,
      Effect.die("no state store is consulted for a unit without a guard"),
    ),
  ),
);
