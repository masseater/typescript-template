import { applicationOrigins, applications, httpStatus } from "@repo/config";
import { Clock, Console, Effect, Schema } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import { FetchHttpClient, HttpClient } from "effect/unstable/http";

import { explorerOrigin, requestTelemetry } from "./explorer.ts";

import type { Application } from "@repo/config";

interface Verified {
  readonly logs: number;
  readonly spans: number;
}

interface VerificationTarget {
  readonly app: string;
  readonly requestId: string;
  readonly service: string;
}

class VerificationFailure extends Schema.TaggedError<VerificationFailure>()("VerificationFailure", {
  reason: Schema.Literals([
    "request_failed",
    "correlation_headers_missing",
    "telemetry_not_correlated",
    "telemetry_unparsable",
  ]),
}) {}

const appTimeoutMilliseconds = 15_000;
const correlationWindowMilliseconds = 45_000;
const pollIntervalMilliseconds = 1000;

function fail(reason: VerificationFailure["reason"]): VerificationFailure {
  return new VerificationFailure({ reason });
}

const correlated = Effect.fn("correlated")(function* correlated(target: VerificationTarget) {
  const telemetry = yield* requestTelemetry(target.app, target.requestId);
  if (
    telemetry.logs.some(
      ({
        event,
      }: Readonly<{ event: Readonly<Record<string, unknown>> | "unparsable" | undefined }>) =>
        event === "unparsable",
    )
  ) {
    return yield* fail("telemetry_unparsable");
  }
  const logged = telemetry.logs.some(
    ({
      event,
    }: Readonly<{ event: Readonly<Record<string, unknown>> | "unparsable" | undefined }>) =>
      typeof event === "object" &&
      event["event"] === "http.server.request" &&
      event["service"] === target.service &&
      event["request_id"] === target.requestId,
  );
  const traced = telemetry.spans.some(
    (span: Readonly<Record<string, unknown>>) =>
      span["parent_id"] === null && span["duration_ms"] !== null,
  );
  const verified: Verified | undefined =
    logged && traced ? { logs: telemetry.logs.length, spans: telemetry.spans.length } : undefined;
  return verified;
});

function waitForCorrelation(
  target: VerificationTarget,
  deadline: number,
): Effect.Effect<Verified, VerificationFailure | Effect.Error<ReturnType<typeof correlated>>> {
  return Effect.gen(function* waitForCorrelationProgram() {
    const now = yield* Clock.currentTimeMillis;
    if (now >= deadline) {
      return yield* fail("telemetry_not_correlated");
    }
    return yield* correlated(target).pipe(
      Effect.filterOrElse(
        (verified): verified is Verified => verified !== undefined,
        () =>
          Effect.sleep(pollIntervalMilliseconds).pipe(
            Effect.andThen(() => waitForCorrelation(target, deadline)),
          ),
      ),
    );
  });
}

const requestApp = Effect.fn("requestApp")(function* requestApp(app: Readonly<URL>) {
  const response = yield* HttpClient.get(app).pipe(
    Effect.timeout(appTimeoutMilliseconds),
    Effect.provide(FetchHttpClient.layer),
    Effect.mapError(() => fail("request_failed")),
  );
  yield* response.arrayBuffer.pipe(Effect.mapError(() => fail("request_failed")));
  const requestId = response.headers["x-request-id"] ?? "";
  if (requestId === "" || response.status >= httpStatus.internalServerError) {
    return yield* fail("correlation_headers_missing");
  }
  return { requestId, status: response.status };
});

const verify = Effect.fn("verify")(function* verify(application: Application) {
  const service = `${application}-server`;
  const app = yield* explorerOrigin(applicationOrigins[application]);
  const { requestId, status } = yield* requestApp(app);
  const verified = yield* waitForCorrelation(
    { app: app.href, requestId, service },
    (yield* Clock.currentTimeMillis) + correlationWindowMilliseconds,
  );
  return {
    ok: true,
    requestId,
    responseStatus: status,
    service,
    signals: ["logs", "traces"],
    ...verified,
  };
});

const verifyCommand = Command.make(
  "verify",
  {
    app: Flag.Literals("app", applications).pipe(
      Flag.withDescription(
        "Running local application to request; its server logs must correlate with the request",
      ),
    ),
  },
  ({ app }) => verify(app).pipe(Effect.flatMap((report) => Console.log(JSON.stringify(report)))),
).pipe(
  Command.withDescription(
    "Request a local app and wait until Local Explorer holds its structured log and completed trace",
  ),
);

export { verifyCommand };
