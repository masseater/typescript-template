import { Effect, Schema } from "effect";

class ErrorMonitorFailure extends Schema.TaggedError<ErrorMonitorFailure>()("ErrorMonitorFailure", {
  code: Schema.Literals([
    "error_monitor_config_invalid",
    "telemetry_account_invalid",
    "telemetry_http_failed",
    "telemetry_response_invalid",
  ]),
}) {}

const MIN_OBSERVABILITY_TOKEN_LENGTH = 20;

const ErrorMonitorEnvironment = Schema.Struct({
  CLOUDFLARE_ACCOUNT_ID: Schema.String.check(Schema.isPattern(/^[a-f0-9]{32}$/u)),
  OBSERVABILITY_TOKEN: Schema.String.check(Schema.isMinLength(MIN_OBSERVABILITY_TOKEN_LENGTH)),
});

function parseErrorMonitorConfig(
  input: unknown,
): Effect.Effect<
  { readonly CLOUDFLARE_ACCOUNT_ID: string; readonly OBSERVABILITY_TOKEN: string },
  ErrorMonitorFailure
> {
  return Schema.decodeUnknownEffect(ErrorMonitorEnvironment)(input).pipe(
    Effect.mapError(() => new ErrorMonitorFailure({ code: "error_monitor_config_invalid" })),
  );
}

export { ErrorMonitorFailure, parseErrorMonitorConfig };
