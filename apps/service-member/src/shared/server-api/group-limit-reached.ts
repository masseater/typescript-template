import { Schema } from "effect";

class GroupLimitReached extends Schema.TaggedError<GroupLimitReached>()("GroupLimitReached", {}) {}

export { GroupLimitReached };
