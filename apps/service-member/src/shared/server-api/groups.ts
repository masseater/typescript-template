import { CONVERSATION_KIND, GROUP_JOIN_POLICY, GROUP_MEMBERSHIP_ROLE, ROLE } from "@repo/config";
import { query, schema } from "@repo/db";
import { and, count, desc, eq } from "drizzle-orm";
import { Clock, Effect } from "effect";

import { GroupInviteExpired } from "./group-invite-expired.ts";
import { GroupLimitReached } from "./group-limit-reached.ts";
import { GroupNotFound } from "./group-not-found.ts";
import { MessagingMemberRequired } from "./messaging-member-required.ts";

import type { GroupJoinPolicy } from "@repo/config";

const { conversation, conversationParticipant, groupInvite, groupMembership, memberGroup, user } =
  schema;

const maximumGroupNameLength = 100;
const maximumGroupMembers = 100;
const maximumGroupsOwned = 20;
const maximumGroupsJoined = 50;
const inviteTtlMillis = 7 * 24 * 60 * 60 * 1000;

interface GroupView {
  readonly conversationId: string;
  readonly id: string;
  readonly inviteExpired: boolean;
  readonly inviteToken: string | null;
  readonly isMember: boolean;
  readonly isOwner: boolean;
  readonly joinPolicy: GroupJoinPolicy;
  readonly memberCount: number;
  readonly members: readonly {
    readonly id: string;
    readonly joinedAt: number;
    readonly name: string;
  }[];
  readonly name: string;
  readonly owner: { readonly id: string; readonly name: string };
}

const messagingMember = and(
  eq(user.role, ROLE.member),
  eq(user.emailVerified, true),
  eq(user.suspended, false),
);
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

const canViewGroup = Effect.fn("canViewGroup")(function* canViewGroup(
  viewerId: string,
  group: { readonly id: string; readonly joinPolicy: GroupJoinPolicy },
  inviteToken: string | undefined,
) {
  if ((yield* membershipOf(viewerId, group.id)) !== undefined) {
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

const createGroup = Effect.fn("createGroup")(function* createGroup(
  ownerId: string,
  draft: { readonly joinPolicy: GroupJoinPolicy; readonly name: string },
) {
  const owner = yield* requireMessagingMember(ownerId);
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
  const inviteToken = crypto.randomUUID();
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
        joinedAt: now,
        lastReadAt: now,
        memberId: owner.id,
        memberName: owner.name,
      }),
      database.insert(groupInvite).values({
        expiresAt: new Date(now.getTime() + inviteTtlMillis),
        groupId,
        id: crypto.randomUUID(),
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
  const [memberCount] = yield* query((database) =>
    database
      .select({ count: count() })
      .from(groupMembership)
      .where(eq(groupMembership.groupId, groupId)),
  );
  const invite = yield* inviteFor(groupId);
  const now = yield* clockDate;
  const view: GroupView = {
    conversationId: group.conversationId,
    id: group.id,
    inviteExpired: invite !== undefined && invite.expiresAt.getTime() <= now.getTime(),
    inviteToken: membership === undefined ? null : (invite?.token ?? null),
    isMember: membership !== undefined,
    isOwner: membership?.role === GROUP_MEMBERSHIP_ROLE.owner,
    joinPolicy: group.joinPolicy,
    memberCount: memberCount?.count ?? 0,
    members: rows.map((row) => ({ id: row.id, joinedAt: row.joinedAt.getTime(), name: row.name })),
    name: group.name,
    owner: { id: group.ownerId, name: group.ownerName },
  };
  return view;
});

const joinGroup = Effect.fn("joinGroup")(function* joinGroup(
  viewerId: string,
  groupId: string,
  inviteToken?: string,
) {
  const member = yield* requireMessagingMember(viewerId);
  const group = yield* loadGroupRow(groupId);
  if ((yield* membershipOf(viewerId, groupId)) !== undefined) {
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
        joinedAt: now,
        lastReadAt: now,
        memberId: member.id,
        memberName: member.name,
      }),
    ]),
  );
  return group.conversationId;
});

const listOpenGroups = Effect.fn("listOpenGroups")(function* listOpenGroups(viewerId: string) {
  yield* requireMessagingMember(viewerId);
  const rows = yield* query((database) =>
    database
      .select({ id: memberGroup.id, name: memberGroup.name })
      .from(memberGroup)
      .where(eq(memberGroup.joinPolicy, GROUP_JOIN_POLICY.open))
      .orderBy(memberGroup.name, memberGroup.id)
      .limit(50),
  );
  return rows;
});

export { createGroup, findGroup, joinGroup, listOpenGroups };
