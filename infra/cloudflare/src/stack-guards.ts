import type { StateService } from "alchemy/State";
import { Effect } from "effect";

import type { AccountAccess } from "./account-read.ts";
import type { SharedConfig } from "./config.ts";
import { assertDatabaseMigrated, assertDatabaseUnclaimed } from "./database-guard.ts";
import { assertSendingDomainUnclaimed } from "./email-guard.ts";
import { assertTraceDestinationApplied } from "./observability-guard.ts";
import type { StackName } from "./stacks.ts";
import {
  applicationStacks,
  onboardingStack,
  stackDependencies,
  traceDestinationStack,
} from "./stacks.ts";

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
  if (applicationStacks.some((application) => application === stack)) {
    yield* assertDatabaseMigrated(deployment.access, deployment.config);
  }
  if (stack === onboardingStack) {
    yield* assertSendingDomainUnclaimed(deployment.access, deployment.config, store);
  }
  if (stackDependencies(stack).includes(traceDestinationStack)) {
    yield* assertTraceDestinationApplied(deployment.config, store);
  }
});

export { assertStackReady };
