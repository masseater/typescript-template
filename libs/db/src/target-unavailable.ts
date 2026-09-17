import { Schema } from "effect";

class TargetUnavailable extends Schema.TaggedError<TargetUnavailable>()("TargetUnavailable", {}) {}

export { TargetUnavailable };
