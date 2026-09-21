import { groupJoinPolicies } from "@repo/config";
import { Schema } from "effect";

import { Identifier } from "./member.ts";

const maximumGroupNameLength = 100;

const GroupMemberView = Schema.Struct({
  id: Schema.String,
  joinedAt: Schema.Number,
  name: Schema.String,
});

const GroupView = Schema.Struct({
  conversationId: Schema.String,
  id: Schema.String,
  inviteExpired: Schema.Boolean,
  inviteToken: Schema.NullOr(Schema.String),
  isMember: Schema.Boolean,
  isOwner: Schema.Boolean,
  joinPolicy: Schema.Literals(groupJoinPolicies),
  memberCount: Schema.Finite,
  members: Schema.Array(GroupMemberView),
  name: Schema.String,
  owner: Schema.Struct({ id: Schema.String, name: Schema.String }),
});

const GroupQuery = Schema.Struct({
  id: Identifier,
  invite: Schema.optionalKey(Schema.String),
});

const GroupCreate = Schema.Struct({
  joinPolicy: Schema.Literals(groupJoinPolicies),
  name: Schema.Trim.check(Schema.isLengthBetween(1, maximumGroupNameLength)),
});

const GroupCreated = Schema.Struct({
  conversationId: Schema.String,
  groupId: Schema.String,
  inviteToken: Schema.String,
});

const GroupJoin = Schema.Struct({
  id: Identifier,
  invite: Schema.optionalKey(Schema.String),
});

const GroupJoined = Schema.Struct({ conversationId: Schema.String });

const OpenGroup = Schema.Struct({ id: Schema.String, name: Schema.String });
const OpenGroupList = Schema.Struct({ groups: Schema.Array(OpenGroup) });

export {
  GroupCreate,
  GroupCreated,
  GroupJoin,
  GroupJoined,
  GroupQuery,
  GroupView,
  OpenGroupList,
  maximumGroupNameLength,
};
