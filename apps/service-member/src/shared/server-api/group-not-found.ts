import { Schema } from "effect";

class GroupNotFound extends Schema.TaggedError<GroupNotFound>()("GroupNotFound", {}) {}

export { GroupNotFound };
