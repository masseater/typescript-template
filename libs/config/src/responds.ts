import { Effect, Schedule, type Duration } from "effect";

const firstSuccess = 200;
const firstRedirect = 300;

const respondedSuccessfully = (httpStatus: number): boolean =>
  httpStatus >= firstSuccess && httpStatus < firstRedirect;

const waitUntilResponds = <Failure>(probe: {
  readonly accept: (httpStatus: number) => boolean;
  readonly method: "GET" | "POST";
  readonly onStatus: (httpStatus: number) => Failure;
  readonly onUnreachable: (unreachableFailure: unknown) => Failure;
  readonly retry?: {
    readonly interval: `${number} ${Duration.Unit}`;
    readonly times: number;
  };
  readonly timeoutMilliseconds?: number;
  readonly url: string;
}): Effect.Effect<number, Failure> => {
  const attempt = Effect.tryPromise({
    catch: (unreachableFailure) => probe.onUnreachable(unreachableFailure),
    try: async () => {
      const fetched = await fetch(probe.url, {
        method: probe.method,
        redirect: "manual",
        ...(probe.timeoutMilliseconds === undefined
          ? {}
          : { signal: AbortSignal.timeout(probe.timeoutMilliseconds) }),
      });
      const responseBody = fetched.body;
      if (responseBody !== null) {
        await responseBody.cancel();
      }
      return fetched.status;
    },
  }).pipe(
    Effect.flatMap((httpStatus) =>
      probe.accept(httpStatus)
        ? Effect.succeed(httpStatus)
        : Effect.fail(probe.onStatus(httpStatus)),
    ),
  );
  const scheduledRetry = probe.retry;
  if (scheduledRetry === undefined) {
    return attempt;
  }
  return attempt.pipe(
    Effect.retry({
      schedule: Schedule.spaced(scheduledRetry.interval),
      times: scheduledRetry.times,
    }),
  );
};

export { respondedSuccessfully, waitUntilResponds };
