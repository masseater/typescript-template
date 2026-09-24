import { Schema } from "effect";

class TrustTargetUnavailable extends Schema.TaggedError<TrustTargetUnavailable>()(
  "TrustTargetUnavailable",
  {},
) {}

export { TrustTargetUnavailable };
