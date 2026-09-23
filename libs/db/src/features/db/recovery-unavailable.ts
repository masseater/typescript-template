import { Schema } from "effect";

class RecoveryUnavailable extends Schema.TaggedError<RecoveryUnavailable>()(
  "RecoveryUnavailable",
  {},
) {}

export { RecoveryUnavailable };
