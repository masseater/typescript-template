import { Schema } from "effect";

class JwksUnavailable extends Schema.TaggedError<JwksUnavailable>()("JwksUnavailable", {}) {}

export { JwksUnavailable };
