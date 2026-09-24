import { Schema } from "effect";

class RecoveryExpired extends Schema.TaggedError<RecoveryExpired>()("RecoveryExpired", {}) {}

export { RecoveryExpired };
