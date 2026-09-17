import { Effect, Schema } from "effect";

export class ErrorMonitorFailure extends Schema.TaggedError<ErrorMonitorFailure>()(
  "ErrorMonitorFailure",
  {
    code: Schema.Literals([
      "error_monitor_config_invalid",
      "telemetry_account_invalid",
      "telemetry_http_failed",
      "telemetry_response_invalid",
    ]),
  },
) {}

const ErrorMonitorEnvironment = Schema.Struct({
  CLOUDFLARE_ACCOUNT_ID: Schema.String.check(Schema.isPattern(/^[a-f0-9]{32}$/)),
  OBSERVABILITY_TOKEN: Schema.String.check(Schema.isMinLength(20)),
});

export const parseErrorMonitorConfig = (input: unknown) =>
  Schema.decodeUnknownEffect(ErrorMonitorEnvironment)(input).pipe(
    Effect.mapError(() => new ErrorMonitorFailure({ code: "error_monitor_config_invalid" })),
  );
