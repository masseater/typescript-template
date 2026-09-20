import { ROLE } from "@repo/config";
import {
  CONVERSATION_KIND,
  GROUP_JOIN_POLICY,
  GROUP_MEMBERSHIP_ROLE,
  query,
  schema,
} from "@repo/db";
import { and, count, desc, eq } from "drizzle-orm";
import { Clock, Effect } from "effect";

import { mayCreateGroup } from "#shared/messaging/may-create-group.ts";
import { GroupInviteExpired } from "./group-invite-expired.ts";
import { GroupLimitReached } from "./group-limit-reached.ts";
import { GroupNotFound } from "./group-not-found.ts";
import { MessagingMemberRequired } from "./messaging-member-required.ts";

const { conversation, conversationParticipant, groupInvite, groupMembership, memberGroup, user } =
  schema;

const maximumGroupNameLength = 100;
const maximumGroupMembers = 100;
const maximumGroupsOwned = 20;
const maximumGroupsJoined = 50;
const inviteTtlMillis = 7 * 24 * 60 * 60 * 1000;

interface GroupOwner {
  readonly id: string;
  readonly name: string;
}

interface GroupMemberView {
  readonly id: string;
  readonly joinedAt: number;
  readonly name: string;
}

interface GroupView {
  readonly conversationId: string;
  readonly id: string;
  readonly inviteExpired: boolean;
  readonly isMember: boolean;
  readonly isOwner: boolean;
  readonly joinPolicy: typeof GROUP_JOIN_POLICY.invite | typeof GROUP_JOIN_POLICY.open;
  readonly memberCount: number;
  readonly members: readonly GroupMemberView[];
  readonly name: string;
  readonly owner: GroupOwner;
}

const messagingMember = and(eq(user.role, ROLE.member), eq(user.emailVerified, true));
const clockDate = Effect.map(Clock.currentTimeMillis, (millis) => new Date(millis));

const requireMessagingMember = Effect.fn("requireMessagingMember")(function* requireMessagingMember(
  userId: string,
) {
  const [member] = yield* query((database) =>
    database
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(and(eq(user.id, userId), messagingMember))
      .limit(1),
  );
  if (member === undefined) {
    return yield* new MessagingMemberRequired();
  }
  return member;
});

function trimGroupName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > maximumGroupNameLength) {
    return "";
  }
  return trimmed;
}

const membershipOf = Effect.fn("membershipOf")(function* membershipOf(
  viewerId: string,
  groupId: string,
) {
  const [membership] = yield* query((database) =>
    database
      .select({ role: groupMembership.role })
      .from(groupMembership)
      .where(and(eq(groupMembership.groupId, groupId), eq(groupMembership.memberId, viewerId)))
      .limit(1),
  );
  return membership;
});

const inviteFor = Effect.fn("inviteFor")(function* inviteFor(groupId: string) {
  const [invite] = yield* query((database) =>
    database
      .select({ expiresAt: groupInvite.expiresAt, token: groupInvite.token })
      .from(groupInvite)
      .where(eq(groupInvite.groupId, groupId))
      .orderBy(desc(groupInvite.expiresAt))
      .limit(1),
  );
  return invite;
});

const canViewGroup = Effect.fn("canViewGroup")(function* canViewGroup(
  viewerId: string,
  group: {
    readonly id: string;
    readonly joinPolicy: typeof GROUP_JOIN_POLICY.invite | typeof GROUP_JOIN_POLICY.open;
  },
  inviteToken: string | undefined,
) {
  const membership = yield* membershipOf(viewerId, group.id);
  if (membership !== undefined) {
    return true;
  }
  if (group.joinPolicy === GROUP_JOIN_POLICY.open) {
    return true;
  }
  if (inviteToken === undefined) {
    return false;
  }
  const invite = yield* inviteFor(group.id);
  if (invite === undefined || invite.token !== inviteToken) {
    return false;
  }
  const now = yield* clockDate;
  return invite.expiresAt.getTime() > now.getTime();
});

const loadGroupRow = Effect.fn("loadGroupRow")(function* loadGroupRow(groupId: string) {
  const [group] = yield* query((database) =>
    database
      .select({
        conversationId: memberGroup.conversationId,
        id: memberGroup.id,
        joinPolicy: memberGroup.joinPolicy,
        name: memberGroup.name,
        ownerId: memberGroup.ownerId,
        ownerName: user.name,
      })
      .from(memberGroup)
      .innerJoin(user, eq(user.id, memberGroup.ownerId))
      .where(eq(memberGroup.id, groupId))
      .limit(1),
  );
  if (group === undefined) {
    return yield* new GroupNotFound();
  }
  return group;
});

const loadMembers = Effect.fn("loadMembers")(function* loadMembers(groupId: string) {
  const rows = yield* query((database) =>
    database
      .select({
        id: groupMembership.memberId,
        joinedAt: groupMembership.joinedAt,
        name: user.name,
      })
      .from(groupMembership)
      .innerJoin(user, eq(user.id, groupMembership.memberId))
      .where(eq(groupMembership.groupId, groupId))
      .orderBy(desc(groupMembership.joinedAt)),
  );
  return rows.map((row) => ({
    id: row.id,
    joinedAt: row.joinedAt.getTime(),
    name: row.name,
  }));
});

const createGroup = Effect.fn("createGroup")(function* createGroup(
  ownerId: string,
  draft: {
    readonly joinPolicy: typeof GROUP_JOIN_POLICY.invite | typeof GROUP_JOIN_POLICY.open;
    readonly name: string;
  },
) {
  const owner = yield* requireMessagingMember(ownerId);
  if (!(yield* mayCreateGroup(ownerId))) {
    return yield* new GroupNotFound();
  }
  const name = trimGroupName(draft.name);
  if (name === "") {
    return yield* new GroupNotFound();
  }
  const [owned] = yield* query((database) =>
    database
      .select({ count: count() })
      .from(groupMembership)
      .where(
        and(
          eq(groupMembership.memberId, ownerId),
          eq(groupMembership.role, GROUP_MEMBERSHIP_ROLE.owner),
        ),
      ),
  );
  if ((owned?.count ?? 0) >= maximumGroupsOwned) {
    return yield* new GroupLimitReached();
  }
  const now = yield* clockDate;
  const conversationId = crypto.randomUUID();
  const groupId = crypto.randomUUID();
  const inviteId = crypto.randomUUID();
  const inviteToken = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + inviteTtlMillis);
  yield* query((database) =>
    database.batch([
      database.insert(conversation).values({
        id: conversationId,
        kind: CONVERSATION_KIND.group,
        lastMessageAt: now,
      }),
      database.insert(memberGroup).values({
        conversationId,
        id: groupId,
        joinPolicy: draft.joinPolicy,
        name,
        ownerId: owner.id,
      }),
      database.insert(groupMembership).values({
        groupId,
        joinedAt: now,
        memberId: owner.id,
        role: GROUP_MEMBERSHIP_ROLE.owner,
      }),
      database.insert(conversationParticipant).values({
        conversationId,
        id: crypto.randomUUID(),
        joinedAt: now,
        lastReadAt: now,
        memberId: owner.id,
        memberName: owner.name,
      }),
      database.insert(groupInvite).values({
        expiresAt,
        groupId,
        id: inviteId,
        token: inviteToken,
      }),
    ]),
  );
  return { conversationId, groupId, inviteToken };
});

const findGroup = Effect.fn("findGroup")(function* findGroup(
  viewerId: string,
  groupId: string,
  inviteToken?: string,
) {
  yield* requireMessagingMember(viewerId);
  const group = yield* loadGroupRow(groupId);
  if (!(yield* canViewGroup(viewerId, group, inviteToken))) {
    return yield* new GroupNotFound();
  }
  const membership = yield* membershipOf(viewerId, groupId);
  const members = yield* loadMembers(groupId);
  const [memberCount] = yield* query((database) =>
    database
      .select({ count: count() })
      .from(groupMembership)
      .where(eq(groupMembership.groupId, groupId)),
  );
  const invite = yield* inviteFor(groupId);
  const now = yield* clockDate;
  const inviteExpired =
    invite !== undefined && invite.expiresAt.getTime() <= now.getTime() ? true : false;
  return {
    conversationId: group.conversationId,
    id: group.id,
    inviteExpired,
    isMember: membership !== undefined,
    isOwner: membership?.role === GROUP_MEMBERSHIP_ROLE.owner,
    joinPolicy: group.joinPolicy,
    memberCount: memberCount?.count ?? 0,
    members,
    name: group.name,
    owner: { id: group.ownerId, name: group.ownerName },
  } satisfies GroupView;
});

const joinGroup = Effect.fn("joinGroup")(function* joinGroup(
  viewerId: string,
  groupId: string,
  inviteToken?: string,
) {
  const member = yield* requireMessagingMember(viewerId);
  const group = yield* loadGroupRow(groupId);
  const existingMembership = yield* membershipOf(viewerId, groupId);
  if (existingMembership !== undefined) {
    return group.conversationId;
  }
  if (group.joinPolicy === GROUP_JOIN_POLICY.invite) {
    if (inviteToken === undefined) {
      return yield* new GroupNotFound();
    }
    const invite = yield* inviteFor(groupId);
    const now = yield* clockDate;
    if (invite === undefined || invite.token !== inviteToken) {
      return yield* new GroupNotFound();
    }
    if (invite.expiresAt.getTime() <= now.getTime()) {
      return yield* new GroupInviteExpired();
    }
  }
  const [joined] = yield* query((database) =>
    database
      .select({ count: count() })
      .from(groupMembership)
      .where(eq(groupMembership.memberId, viewerId)),
  );
  if ((joined?.count ?? 0) >= maximumGroupsJoined) {
    return yield* new GroupLimitReached();
  }
  const [members] = yield* query((database) =>
    database
      .select({ count: count() })
      .from(groupMembership)
      .where(eq(groupMembership.groupId, groupId)),
  );
  if ((members?.count ?? 0) >= maximumGroupMembers) {
    return yield* new GroupLimitReached();
  }
  const now = yield* clockDate;
  yield* query((database) =>
    database.batch([
      database.insert(groupMembership).values({
        groupId,
        joinedAt: now,
        memberId: member.id,
        role: GROUP_MEMBERSHIP_ROLE.member,
      }),
      database.insert(conversationParticipant).values({
        conversationId: group.conversationId,
        id: crypto.randomUUID(),
        joinedAt: now,
        lastReadAt: now,
        memberId: member.id,
        memberName: member.name,
      }),
    ]),
  );
  return group.conversationId;
});

const leaveGroup = Effect.fn("leaveGroup")(function* leaveGroup(viewerId: string, groupId: string) {
  yield* requireMessagingMember(viewerId);
  const group = yield* loadGroupRow(groupId);
  const membership = yield* membershipOf(viewerId, groupId);
  if (membership === undefined) {
    return yield* new GroupNotFound();
  }
  if (membership.role === GROUP_MEMBERSHIP_ROLE.owner) {
    return yield* new GroupNotFound();
  }
  yield* query((database) =>
    database.batch([
      database
        .delete(groupMembership)
        .where(and(eq(groupMembership.groupId, groupId), eq(groupMembership.memberId, viewerId))),
      database
        .delete(conversationParticipant)
        .where(
          and(
            eq(conversationParticipant.conversationId, group.conversationId),
            eq(conversationParticipant.memberId, viewerId),
          ),
        ),
    ]),
  );
});

const renameGroup = Effect.fn("renameGroup")(function* renameGroup(
  viewerId: string,
  groupId: string,
  name: string,
) {
  yield* requireMessagingMember(viewerId);
  const trimmed = trimGroupName(name);
  if (trimmed === "") {
    return yield* new GroupNotFound();
  }
  const membership = yield* membershipOf(viewerId, groupId);
  if (membership?.role !== GROUP_MEMBERSHIP_ROLE.owner) {
    return yield* new GroupNotFound();
  }
  yield* query((database) =>
    database.update(memberGroup).set({ name: trimmed }).where(eq(memberGroup.id, groupId)),
  );
});

const refreshGroupInvite = Effect.fn("refreshGroupInvite")(function* refreshGroupInvite(
  viewerId: string,
  groupId: string,
) {
  yield* requireMessagingMember(viewerId);
  const membership = yield* membershipOf(viewerId, groupId);
  if (membership === undefined) {
    return yield* new GroupNotFound();
  }
  const now = yield* clockDate;
  const inviteToken = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + inviteTtlMillis);
  yield* query((database) =>
    database.batch([
      database.delete(groupInvite).where(eq(groupInvite.groupId, groupId)),
      database.insert(groupInvite).values({
        expiresAt,
        groupId,
        id: crypto.randomUUID(),
        token: inviteToken,
      }),
    ]),
  );
  return inviteToken;
});

const groupIdForConversation = Effect.fn("groupIdForConversation")(function* groupIdForConversation(
  conversationId: string,
) {
  const [group] = yield* query((database) =>
    database
      .select({ id: memberGroup.id })
      .from(memberGroup)
      .where(eq(memberGroup.conversationId, conversationId))
      .limit(1),
  );
  return group?.id;
});

const isGroupMember = Effect.fn("isGroupMember")(function* isGroupMember(
  viewerId: string,
  conversationId: string,
) {
  const groupId = yield* groupIdForConversation(conversationId);
  if (groupId === undefined) {
    return false;
  }
  const membership = yield* membershipOf(viewerId, groupId);
  return membership !== undefined;
});

const canReadGroupConversation = Effect.fn("canReadGroupConversation")(
  function* canReadGroupConversation(viewerId: string, conversationId: string) {
    const [group] = yield* query((database) =>
      database
        .select({
          groupId: memberGroup.id,
          joinPolicy: memberGroup.joinPolicy,
        })
        .from(memberGroup)
        .innerJoin(conversation, eq(conversation.id, memberGroup.conversationId))
        .where(
          and(
            eq(memberGroup.conversationId, conversationId),
            eq(conversation.kind, CONVERSATION_KIND.group),
          ),
        )
        .limit(1),
    );
    if (group === undefined) {
      return false;
    }
    if (group.joinPolicy === GROUP_JOIN_POLICY.open) {
      return yield* isGroupMember(viewerId, conversationId);
    }
    return yield* isGroupMember(viewerId, conversationId);
  },
);

export {
  canReadGroupConversation,
  createGroup,
  findGroup,
  joinGroup,
  leaveGroup,
  refreshGroupInvite,
  renameGroup,
};
