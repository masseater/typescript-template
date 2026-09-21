import { Duration, Effect, Layer, Schedule } from "effect";
import { FetchHttpClient, HttpClient } from "effect/unstable/http";

const firstSuccess = 200;
const firstRedirect = 300;

const clientLayer = Layer.mergeAll(
  FetchHttpClient.layer,
  Layer.succeed(FetchHttpClient.RequestInit, { redirect: "manual" }),
);

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
  const send =
    request.method === "GET" ? HttpClient.get(request.url) : HttpClient.post(request.url);
  const timed =
    request.timeoutMilliseconds === undefined
      ? send
      : send.pipe(Effect.timeout(Duration.millis(request.timeoutMilliseconds)));
  const attempt = timed.pipe(
    Effect.mapError((error) => request.onUnreachable(error)),
    Effect.flatMap((response) =>
      response.arrayBuffer.pipe(Effect.as(response.status), Effect.orDie),
    ),
    Effect.filterOrFail(
      (status) => request.accept(status),
      (status) => request.onStatus(status),
    ),
    Effect.provide(clientLayer),
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
