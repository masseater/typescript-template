import { Effect, Layer, Schedule, type Duration } from "effect";
import { FetchHttpClient, HttpClient } from "effect/unstable/http";

const firstSuccess = 200;
const firstRedirect = 300;

const respondedSuccessfully = (httpStatus: number): boolean =>
  httpStatus >= firstSuccess && httpStatus < firstRedirect;

const probeHttp = Layer.mergeAll(
  FetchHttpClient.layer,
  Layer.succeed(FetchHttpClient.RequestInit, { redirect: "manual" }),
);

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
  const attempt = Effect.gen(function* probeOnce() {
    const httpProbe =
      probe.method === "POST" ? HttpClient.post(probe.url) : HttpClient.get(probe.url);
    const httpResponse = yield* httpProbe.pipe(
      Effect.timeout(
        probe.timeoutMilliseconds === undefined
          ? "30 seconds"
          : `${probe.timeoutMilliseconds} millis`,
      ),
      Effect.provide(probeHttp),
      Effect.mapError((unreachableFailure) => probe.onUnreachable(unreachableFailure)),
    );
    yield* httpResponse.arrayBuffer.pipe(Effect.ignore);
    return httpResponse.status;
  }).pipe(
    Effect.filterOrFail(
      (httpStatus) => probe.accept(httpStatus),
      (httpStatus) => probe.onStatus(httpStatus),
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
