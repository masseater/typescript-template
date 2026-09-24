import { Schema } from "effect";

class MemberLeaveUnavailable extends Schema.TaggedError<MemberLeaveUnavailable>()(
  "MemberLeaveUnavailable",
  {},
) {}

export { MemberLeaveUnavailable };
