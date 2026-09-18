import type { StateService } from "alchemy/State";
import { Effect } from "effect";

import { CloudflareFailure, traceDestination } from "./config.ts";
import type { SharedConfig } from "./config.ts";
import { traceDestinationStack } from "./stacks.ts";
import { recordedTraceDestinations } from "./state-ownership.ts";

const assertTraceDestinationApplied = Effect.fn("assertTraceDestinationApplied")(
  function* assertTraceDestinationApplied<Failure, Requirements>(
    config: SharedConfig,
    store: Effect.Effect<StateService, Failure, Requirements>,
  ) {
    const destination = traceDestination(config);
    if (destination === undefined) {
      return;
    }
    const applied = yield* recordedTraceDestinations(store, config.prefix);
    if (applied.includes(destination.name)) {
      return;
    }
    return yield* Effect.fail(
      new CloudflareFailure({
        code: "trace_destination_not_applied",
        keys: [traceDestinationStack],
      }),
    );
  },
);

export { assertTraceDestinationApplied };
