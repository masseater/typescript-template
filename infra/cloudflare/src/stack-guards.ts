import { Effect } from "effect";

import { assertDatabaseUnclaimed } from "./database-guard.ts";
import { assertSendingDomainUnclaimed } from "./email-guard.ts";
import { assertTraceDestinationApplied } from "./observability-guard.ts";
import { onboardingStack, stackDependencies, traceDestinationStack } from "./stacks.ts";

import type { StateService } from "alchemy/State";
import type { AccountAccess } from "./account-read.ts";
import type { SharedConfig } from "./config.ts";
import type { StackName } from "./stacks.ts";

const assertStackReady = Effect.fn("assertStackReady")(function* assertStackReady<
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
  if (stackDependencies(stack).includes(traceDestinationStack)) {
    yield* assertTraceDestinationApplied(deployment.config, store);
  }
});

export { assertStackReady };
