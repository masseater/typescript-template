import { Schema } from "effect";

class SessionRequired extends Schema.TaggedError<SessionRequired>()("SessionRequired", {}) {}

export { SessionRequired };
