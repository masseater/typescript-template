import { Schema } from "effect";

class MonitorFailure extends Schema.TaggedError<MonitorFailure>()("MonitorFailure", {
  code: Schema.Literal("alert_config_invalid"),
}) {}

export { MonitorFailure };
