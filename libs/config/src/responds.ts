import { Duration, Effect, Schedule } from "effect";

const firstSuccess = 200;
const firstRedirect = 300;

function respondedSuccessfully(status: number): boolean {
  return status >= firstSuccess && status < firstRedirect;
}

function waitUntilResponds<Rejected, Unreachable>(request: {
  readonly accept: (status: number) => boolean;
  readonly method: "GET" | "POST";
  readonly onStatus: (status: number) => Rejected;
  readonly onUnreachable: (error: unknown) => Unreachable;
  readonly retry?: { readonly interval: Duration.Input; readonly times: number };
  readonly timeoutMilliseconds?: number;
  readonly url: string;
}): Effect.Effect<number, Rejected | Unreachable> {
  const attempt = Effect.tryPromise({
    catch: (error) => request.onUnreachable(error),
    try: async () => {
      const response = await fetch(request.url, {
        method: request.method,
        redirect: "manual",
        ...(request.timeoutMilliseconds === undefined
          ? {}
          : { signal: AbortSignal.timeout(request.timeoutMilliseconds) }),
      });
      const body = response.body;
      if (body !== null) {
        await body.cancel();
      }
      return response.status;
    },
  }).pipe(
    Effect.flatMap((status) =>
      request.accept(status) ? Effect.succeed(status) : Effect.fail(request.onStatus(status)),
    ),
  );
  const retry = request.retry;
  if (retry === undefined) {
    return attempt;
  }
  return attempt.pipe(
    Effect.retry({ schedule: Schedule.spaced(retry.interval), times: retry.times }),
  );
}

export { respondedSuccessfully, waitUntilResponds };
