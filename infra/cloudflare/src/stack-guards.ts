import type { AccountAccess } from "./account-read.ts";
import { Effect } from "effect";
import type { SharedConfig } from "./config.ts";
import type { StackName } from "./stacks.ts";
import type { StateService } from "alchemy/State";
import { assertDatabaseUnclaimed } from "./database-guard.ts";
import { assertSendingDomainUnclaimed } from "./email-guard.ts";
import { onboardingStack } from "./stacks.ts";

const assertStackUnclaimed = Effect.fn("assertStackUnclaimed")(function* assertStackUnclaimed<
  Failure,
  Requirements,
>(
  stack: StackName,
  deployment: Readonly<{ access: AccountAccess; config: SharedConfig }>,
  store: Effect.Effect<StateService, Failure, Requirements>,
) {
  if (stack === "database") {
    yield* assertDatabaseUnclaimed(deployment.access, deployment.config, store);
  }
  if (stack === onboardingStack) {
    yield* assertSendingDomainUnclaimed(deployment.access, deployment.config, store);
  }
});

export { assertStackUnclaimed };
