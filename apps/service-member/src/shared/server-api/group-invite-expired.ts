import { Schema } from "effect";

class GroupInviteExpired extends Schema.TaggedError<GroupInviteExpired>()(
  "GroupInviteExpired",
  {},
) {}

export { GroupInviteExpired };
