import { parseArgs } from "node:util";
import { NodeRuntime } from "@effect/platform-node";
import { Cause, Effect, Schema } from "effect";
import { explorerOrigin, requestTelemetry } from "./explorer.ts";

class VerificationFailure extends Schema.TaggedError<VerificationFailure>()("VerificationFailure", {
  reason: Schema.Literals([
    "arguments_invalid",
    "request_failed",
    "correlation_headers_missing",
    "telemetry_not_correlated",
  ]),
}) {}

const VerifyInput = Schema.Struct({
  app: Schema.String,
  service: Schema.Literals(["user-server", "admin-server", "wiki-server"]),
});

const { values } = parseArgs({
  options: {
    app: { type: "string" },
    service: { type: "string", default: "user-server" },
  },
});

const requestFailed = () => new VerificationFailure({ reason: "request_failed" });

const verify = Effect.gen(function* () {
  const input = yield* Schema.decodeUnknownEffect(VerifyInput)({
    app: values.app,
    service: values.service,
  }).pipe(Effect.mapError(() => new VerificationFailure({ reason: "arguments_invalid" })));
  const app = yield* explorerOrigin(input.app);
  const response = yield* Effect.tryPromise({
    try: (signal) =>
      fetch(app, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
      }),
    catch: requestFailed,
  });
  yield* Effect.tryPromise({ try: async () => response.body?.cancel(), catch: requestFailed });
  const requestId = response.headers.get("x-request-id");
  if (!requestId || response.status >= 500)
    return yield* new VerificationFailure({ reason: "correlation_headers_missing" });
  const deadline = Date.now() + 45_000;
  let verified: { spans: number; logs: number } | undefined;
  while (Date.now() < deadline && !verified) {
    const telemetry = yield* requestTelemetry(app.href, requestId);
    const logged = telemetry.logs.some(
      ({ event }) =>
        event?.["event"] === "http.server.request" &&
        event["service"] === input.service &&
        event["request_id"] === requestId,
    );
    const traced = telemetry.spans.some(
      (span) => span["parent_id"] === null && span["duration_ms"] !== null,
    );
    if (logged && traced) verified = { spans: telemetry.spans.length, logs: telemetry.logs.length };
    else yield* Effect.sleep(1000);
  }
  if (!verified) return yield* new VerificationFailure({ reason: "telemetry_not_correlated" });
  const result = verified;
  yield* Effect.sync(() =>
    console.info(
      JSON.stringify({
        ok: true,
        requestId,
        responseStatus: response.status,
        service: input.service,
        signals: ["logs", "traces"],
        ...result,
      }),
    ),
  );
});

NodeRuntime.runMain(
  verify.pipe(
    Effect.catchCause((cause) =>
      Cause.hasInterruptsOnly(cause)
        ? Effect.failCause(cause)
        : Effect.sync(() => {
            console.error(
              JSON.stringify({
                ok: false,
                event: "observability.verification_failed",
                remediation:
                  "Specify --app with a running local app origin such as http://127.0.0.1:3001/. The request must appear in Local Explorer as a structured log and a completed trace.",
              }),
            );
            process.exitCode = 1;
          }),
    ),
  ),
  { disableErrorReporting: true },
);
