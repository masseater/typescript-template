import { Schema } from "effect";

class RateLimitExceeded extends Schema.TaggedError<RateLimitExceeded>()("RateLimitExceeded", {}) {}

export { RateLimitExceeded };
