import { Effect } from "effect";

/** @canonical-values ai-native.delay-ending */
const DELAY_ENDINGS = ["elapsed", "cancelled"] as const;

export const DELAY_ENDING = {
  elapsed: DELAY_ENDINGS[0],
  cancelled: DELAY_ENDINGS[1],
} as const;

const waitForAbort = (cancel: AbortSignal): Effect.Effect<(typeof DELAY_ENDINGS)[number]> =>
  Effect.callback((resume) => {
    const finish = (): void => {
      resume(Effect.succeed(DELAY_ENDING.cancelled));
    };
    if (cancel.aborted) {
      finish();
      return;
    }
    cancel.addEventListener("abort", finish, { once: true });
    return Effect.sync(() => {
      cancel.removeEventListener("abort", finish);
    });
  });

export const settledDelay = (
  ms: number,
  cancel: AbortSignal,
): Promise<(typeof DELAY_ENDINGS)[number]> =>
  Effect.runPromise(
    waitForAbort(cancel).pipe(
      Effect.timeout(`${ms} millis`),
      Effect.match({
        onFailure: () => DELAY_ENDING.elapsed,
        onSuccess: (ending) => ending,
      }),
    ),
  );
