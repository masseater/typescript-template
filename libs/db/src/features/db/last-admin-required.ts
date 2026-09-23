import { Schema } from "effect";

class LastAdminRequired extends Schema.TaggedError<LastAdminRequired>()("LastAdminRequired", {}) {}

export { LastAdminRequired };
