// oxlint-disable-next-line import/no-nodejs-modules
import { parseArgs } from "node:util";

import { applicationOrigins, applications } from "@repo/config";
import { causeRecord, runCli } from "@repo/config/cli";
import { Console, Effect, Schema } from "effect";

import { explorerOrigin, requestTelemetry } from "./explorer.ts";

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
    "arguments_invalid",
    "request_failed",
    "correlation_headers_missing",
    "telemetry_not_correlated",
    "telemetry_unparsable",
  ]),
}) {}

const appTimeoutMilliseconds = 15_000;
const correlationWindowMilliseconds = 45_000;
const pollIntervalMilliseconds = 1000;
const firstServerErrorStatus = 500;

const VerifyInput = Schema.Struct({
  app: Schema.String,
  service: Schema.Literals(applications.map((application) => `${application}-server` as const)),
});

const { values } = parseArgs({
  options: {
    app: { type: "string" },
    service: { default: "service-member-server", type: "string" },
  },
});

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
      event !== undefined &&
      event !== "unparsable" &&
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
  if (Date.now() >= deadline) {
    return Effect.fail(fail("telemetry_not_correlated"));
  }
  return correlated(target).pipe(
    Effect.flatMap((verified) =>
      verified === undefined
        ? Effect.sleep(pollIntervalMilliseconds).pipe(
            Effect.andThen(() => waitForCorrelation(target, deadline)),
          )
        : Effect.succeed(verified),
    ),
  );
}

const requestApp = Effect.fn("requestApp")(function* requestApp(app: Readonly<URL>) {
  const response = yield* Effect.tryPromise({
    catch: () => fail("request_failed"),
    try: async (signal) =>
      fetch(app, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.any([signal, AbortSignal.timeout(appTimeoutMilliseconds)]),
      }),
  });
  yield* Effect.tryPromise({
    catch: () => fail("request_failed"),
    try: async () => response.body?.cancel(),
  });
  const requestId = response.headers.get("x-request-id") ?? "";
  if (requestId === "" || response.status >= firstServerErrorStatus) {
    return yield* fail("correlation_headers_missing");
  }
  return { requestId, status: response.status };
});

const verify = Effect.fn("verify")(function* verify() {
  const input = yield* Schema.decodeUnknownEffect(VerifyInput)({
    app: values.app,
    service: values.service,
  }).pipe(Effect.mapError(() => fail("arguments_invalid")));
  const app = yield* explorerOrigin(input.app);
  const { requestId, status } = yield* requestApp(app);
  const verified = yield* waitForCorrelation(
    { app: app.href, requestId, service: input.service },
    Date.now() + correlationWindowMilliseconds,
  );
  return {
    ok: true,
    requestId,
    responseStatus: status,
    service: input.service,
    signals: ["logs", "traces"],
    ...verified,
  };
});

runCli(verify().pipe(Effect.flatMap((report) => Console.log(JSON.stringify(report)))), (cause) =>
  causeRecord("observability.verification_failed", cause, {
    remediation: `Specify --app with a running local app origin such as ${applicationOrigins["service-member"]}/. The request must appear in Local Explorer as a structured log and a completed trace.`,
  }),
);
