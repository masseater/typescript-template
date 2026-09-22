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
  return waitUntilRespondsWith(fetch, request);
}

function waitUntilRespondsWith<Rejected, Unreachable>(
  fetchImpl: typeof fetch,
  request: {
    readonly accept: (status: number) => boolean;
    readonly method: "GET" | "POST";
    readonly onStatus: (status: number) => Rejected;
    readonly onUnreachable: (error: unknown) => Unreachable;
    readonly retry?: { readonly interval: Duration.Input; readonly times: number };
    readonly timeoutMilliseconds?: number;
    readonly url: string;
  },
): Effect.Effect<number, Rejected | Unreachable> {
  const attempt = Effect.tryPromise({
    catch: (error) => request.onUnreachable(error),
    try: (signal) =>
      fetchImpl(request.url, {
        method: request.method,
        redirect: "manual",
        signal:
          request.timeoutMilliseconds === undefined
            ? signal
            : AbortSignal.timeout(request.timeoutMilliseconds),
      }).then((response) => response.arrayBuffer().then(() => response.status)),
  }).pipe(
    Effect.filterOrFail(
      (status) => request.accept(status),
      (status) => request.onStatus(status),
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
