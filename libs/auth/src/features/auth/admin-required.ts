import { Schema } from "effect";

class AdminRequired extends Schema.TaggedError<AdminRequired>()("AdminRequired", {}) {}

export { AdminRequired };
