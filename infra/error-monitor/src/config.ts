import { Effect, Schema, SchemaGetter } from "effect";

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

const Email = Schema.String.check(Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/));
const Recipients = Schema.String.pipe(
  Schema.decodeTo(Schema.Array(Email).check(Schema.isLengthBetween(1, 10)), {
    decode: SchemaGetter.transform((value: string) => value.split(",")),
    encode: SchemaGetter.transform((value: readonly string[]) => value.join(",")),
  }),
);

const ErrorMonitorEnvironment = Schema.Struct({
  CLOUDFLARE_ACCOUNT_ID: Schema.String.check(Schema.isPattern(/^[a-f0-9]{32}$/)),
  OBSERVABILITY_TOKEN: Schema.String.check(Schema.isMinLength(20)),
  ALERT_FROM: Email,
  ALERT_TO: Recipients,
});

export type ErrorMonitorConfig = typeof ErrorMonitorEnvironment.Type;

export const parseErrorMonitorConfig = (input: unknown) =>
  Schema.decodeUnknownEffect(ErrorMonitorEnvironment)(input).pipe(
    Effect.mapError(() => new ErrorMonitorFailure({ code: "error_monitor_config_invalid" })),
  );
