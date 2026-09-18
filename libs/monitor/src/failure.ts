import { Schema } from "effect";

class MonitorFailure extends Schema.TaggedError<MonitorFailure>()("MonitorFailure", {
  code: Schema.Literals(["alert_config_invalid", "schedule_failed"]),
}) {}

export { MonitorFailure };
