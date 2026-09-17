import { Schema } from "effect";

class SessionInvalid extends Schema.TaggedError<SessionInvalid>()("SessionInvalid", {}) {}

export { SessionInvalid };
