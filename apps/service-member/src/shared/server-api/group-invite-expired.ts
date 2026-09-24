import { Data } from "effect";

class GroupInviteExpired extends Data.TaggedError("GroupInviteExpired") {}

export { GroupInviteExpired };
