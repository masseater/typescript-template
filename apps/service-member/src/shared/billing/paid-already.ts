import { Schema } from "effect";

class PaidAlready extends Schema.TaggedError<PaidAlready>()("PaidAlready", {}) {}

export { PaidAlready };
