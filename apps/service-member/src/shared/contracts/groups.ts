import { groupJoinPolicies } from "@repo/config";
import { CreatedResource, IdentifierQuery } from "@repo/runtime/contracts";
import { Schema } from "effect";

import { Identifier, MemberReference } from "./member.ts";

const maximumGroupNameLength = 100;

const GroupJoinPolicy = Schema.Literals(groupJoinPolicies);

const GroupOwner = MemberReference;

const GroupMemberView = Schema.Struct({
  id: Schema.String,
  joinedAt: Schema.Finite,
  name: Schema.String,
});

const GroupView = Schema.Struct({
  conversationId: Schema.String,
  id: Schema.String,
  inviteExpired: Schema.Boolean,
  isMember: Schema.Boolean,
  isOwner: Schema.Boolean,
  joinPolicy: GroupJoinPolicy,
  memberCount: Schema.Finite,
  members: Schema.Array(GroupMemberView),
  name: Schema.String,
  owner: GroupOwner,
});

const GroupQuery = Schema.Struct({
  id: Identifier,
  invite: Schema.optionalKey(Schema.String),
});

const GroupCreate = Schema.Struct({
  joinPolicy: GroupJoinPolicy,
  name: Schema.Trim.check(Schema.isLengthBetween(1, maximumGroupNameLength)),
});

const GroupCreated = Schema.Struct({
  conversationId: Schema.String,
  groupId: Schema.String,
  inviteToken: Schema.String,
});

const GroupJoin = Schema.Struct({
  id: Identifier,
  invite: Schema.optional(Schema.String),
});

const GroupJoined = Schema.Struct({ conversationId: Schema.String });

const GroupLeave = IdentifierQuery;

const GroupLeft = CreatedResource;

const GroupRename = Schema.Struct({
  id: Identifier,
  name: Schema.Trim.check(Schema.isLengthBetween(1, maximumGroupNameLength)),
});

const GroupRenamed = CreatedResource;

const GroupInviteRefresh = IdentifierQuery;

const GroupInviteRefreshed = Schema.Struct({ inviteToken: Schema.String });

export {
  GroupCreate,
  GroupCreated,
  GroupInviteRefresh,
  GroupInviteRefreshed,
  GroupJoin,
  GroupJoined,
  GroupLeave,
  GroupLeft,
  GroupQuery,
  GroupRename,
  GroupRenamed,
  GroupView,
};
