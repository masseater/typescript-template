import { Data } from "effect";

class GroupLimitReached extends Data.TaggedError("GroupLimitReached") {}

export { GroupLimitReached };
