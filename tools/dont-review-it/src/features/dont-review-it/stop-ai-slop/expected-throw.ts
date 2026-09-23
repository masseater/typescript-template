import { Effect, Result } from "effect";

export const failingWhenThrown = <A, E>(
  run: () => A,
  isExpected: (thrown: unknown) => thrown is E,
): Effect.Effect<A, E> =>
  Effect.suspend(() => {
    const outcome = Result.try(run);
    if (Result.isSuccess(outcome)) return Effect.succeed(outcome.success);
    return isExpected(outcome.failure) ? Effect.fail(outcome.failure) : Effect.die(outcome.failure);
  });
