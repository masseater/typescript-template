import { Acknowledged } from "@repo/runtime/contracts";
import { Schema } from "effect";

import { MemberReference } from "./member.ts";

const FollowMemberQuery = Schema.Struct({
  memberId: Schema.String.check(Schema.isLengthBetween(1, 256)),
});

const FollowState = Schema.Struct({
  following: Schema.Boolean,
});

const FollowMember = Acknowledged;

const FollowRelation = MemberReference;

const FollowList = Schema.Struct({
  members: Schema.Array(FollowRelation),
});

export { FollowList, FollowMember, FollowMemberQuery, FollowState };
