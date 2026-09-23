import { CloudflareApiToken, CloudflareId } from "@repo/config";
import { errorMonitorEnv, errorMonitorWorker } from "@repo/monitor/workers";
import { Effect, Schema } from "effect";

class ErrorMonitorFailure extends Schema.TaggedError<ErrorMonitorFailure>()("ErrorMonitorFailure", {
  code: Schema.Literals([
    "error_monitor_config_invalid",
    "telemetry_account_invalid",
    "telemetry_http_failed",
    "telemetry_response_invalid",
  ]),
  keys: Schema.Array(Schema.String),
}) {}

const ErrorMonitorEnvironment = Schema.Struct({
  [errorMonitorEnv.accountId]: CloudflareId,
  [errorMonitorEnv.observabilityToken]: CloudflareApiToken,
});

type ErrorMonitorEnv = typeof ErrorMonitorEnvironment.Encoded;

const parseErrorMonitorConfig = (
  input: unknown,
): Effect.Effect<typeof ErrorMonitorEnvironment.Type, ErrorMonitorFailure> =>
  Schema.decodeUnknownEffect(ErrorMonitorEnvironment)(input).pipe(
    Effect.mapError(
      () => new ErrorMonitorFailure({ code: "error_monitor_config_invalid", keys: [] }),
    ),
  );

const observabilityQueryEndpoint = (accountId: string): string =>
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/observability/telemetry/query`;

export {
  ErrorMonitorFailure,
  errorMonitorEnv,
  errorMonitorWorker,
  observabilityQueryEndpoint,
  parseErrorMonitorConfig,
};
export type { ErrorMonitorEnv };
