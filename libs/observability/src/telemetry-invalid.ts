import { Schema } from "effect";
class TelemetryInvalid extends Schema.TaggedError<TelemetryInvalid>()("TelemetryInvalid", {
  reason: Schema.Literals(["routes"]),
}) {}
export { TelemetryInvalid };
