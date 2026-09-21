import { Schema } from "effect";

const FollowMemberQuery = Schema.Struct({
  memberId: Schema.String.check(Schema.isLengthBetween(1, 256)),
});

const FollowState = Schema.Struct({
  following: Schema.Boolean,
});

const FollowMember = Schema.Struct({
  ok: Schema.Literal(true),
});

const FollowRelation = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
});

const FollowList = Schema.Struct({
  members: Schema.Array(FollowRelation),
});

export { FollowList, FollowMember, FollowMemberQuery, FollowState };
