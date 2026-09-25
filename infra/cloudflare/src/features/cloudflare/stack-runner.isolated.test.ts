import { assert, it } from "@effect/vitest";
import { Effect } from "effect";

import { mockServer } from "./account-test-fixture.ts";
import { access, accountHandlers, config, sendingRecords } from "./inspection-test-fixture.ts";
import { describeCause } from "./secrets.ts";
import { runDeployment } from "./stack-runner.ts";

const CONFIRMATION = "0".repeat(16);
const deployment = {
  access,
  approvalOutput: undefined,
  config,
  secrets: { contents: "", filename: "/dev/null" },
};

it.effect("refuses to apply the onboarding unit before the account guard clears it", () =>
  Effect.gen(function* program() {
    yield* mockServer(...accountHandlers({ records: sendingRecords }));
    const cause = yield* runDeployment(
      { confirmation: CONFIRMATION, operation: "deploy", stack: "email" },
      deployment,
    ).pipe(Effect.sandbox, Effect.flip);
    assert.deepStrictEqual(describeCause(cause, []), {
      code: "sending_domain_unavailable",
      keys: ["emailSending"],
    });
  }).pipe(Effect.scoped),
);
