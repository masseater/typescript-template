import { DateTime, Effect } from "effect";

import { failed, type JourneyFailure } from "./journey-failure.ts";

const pollInterval = "250 millis";

const until = <Value>(polling: {
  readonly attempt: () => Effect.Effect<Value | undefined, JourneyFailure>;
  readonly deadline: number;
  readonly reason: string;
}): Effect.Effect<Value, JourneyFailure> =>
  Effect.gen(function* pollUntil() {
    const found = yield* polling.attempt();
    if (found !== undefined) {
      return found;
    }
    if (DateTime.toEpochMillis(DateTime.nowUnsafe()) >= polling.deadline) {
      return yield* failed(polling.reason);
    }
    yield* Effect.sleep(pollInterval);
    return yield* until(polling);
  });

const deadlineIn = (milliseconds: number): number =>
  DateTime.toEpochMillis(DateTime.nowUnsafe()) + milliseconds;

export { deadlineIn, until };
