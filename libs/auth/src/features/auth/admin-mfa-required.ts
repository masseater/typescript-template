import { Schema } from "effect";

class AdminMfaRequired extends Schema.TaggedError<AdminMfaRequired>()("AdminMfaRequired", {}) {}

export { AdminMfaRequired };
