import { Data } from "effect";

class GroupNotFound extends Data.TaggedError("GroupNotFound") {}

export { GroupNotFound };
