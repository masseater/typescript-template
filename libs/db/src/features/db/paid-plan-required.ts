import { Schema } from "effect";

class PaidPlanRequired extends Schema.TaggedError<PaidPlanRequired>()("PaidPlanRequired", {}) {}

export { PaidPlanRequired };
