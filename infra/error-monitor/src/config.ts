import { CloudflareApiToken, CloudflareId } from "@repo/config";
import { deploymentKey } from "@repo/observability/deployment-keys";
import { Effect, Schema } from "effect";

class ErrorMonitorFailure extends Schema.TaggedError<ErrorMonitorFailure>()("ErrorMonitorFailure", {
  code: Schema.Literals([
    "error_monitor_config_invalid",
    "telemetry_account_invalid",
    "telemetry_groups_dropped",
    "telemetry_http_failed",
    "telemetry_response_invalid",
  ]),
  keys: Schema.Array(Schema.String),
}) {}

const errorMonitorWorker = {
  className: "ErrorMonitor",
  cron: "*/5 * * * *",
  event: "error_monitor",
  name: "errors",
} as const;

const errorMonitorEnv = {
  accountId: deploymentKey.cloudflareAccountId,
  observabilityToken: "OBSERVABILITY_TOKEN",
} as const;

const ErrorMonitorEnvironment = Schema.Struct({
  [errorMonitorEnv.accountId]: CloudflareId,
  [errorMonitorEnv.observabilityToken]: CloudflareApiToken,
});

type ErrorMonitorEnv = typeof ErrorMonitorEnvironment.Encoded;

function parseErrorMonitorConfig(
  input: unknown,
): Effect.Effect<typeof ErrorMonitorEnvironment.Type, ErrorMonitorFailure> {
  return Schema.decodeUnknownEffect(ErrorMonitorEnvironment)(input).pipe(
    Effect.mapError(
      () => new ErrorMonitorFailure({ code: "error_monitor_config_invalid", keys: [] }),
    ),
  );
}

export { ErrorMonitorFailure, errorMonitorEnv, errorMonitorWorker, parseErrorMonitorConfig };
export type { ErrorMonitorEnv };
