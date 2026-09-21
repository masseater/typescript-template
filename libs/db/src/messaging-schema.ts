import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { groupJoinPolicies } from "./group-join-policy.ts";
import { user } from "./identity-schema.ts";

/** @canonical-values db.conversation-kind */
export const conversationKinds = ["direct", "group"] as const;
export type ConversationKind = (typeof conversationKinds)[number];
export const CONVERSATION_KIND = {
  direct: conversationKinds[0],
  group: conversationKinds[1],
} as const;

/** @canonical-values db.group-membership-role */
export const groupMembershipRoles = ["owner", "member"] as const;
export type GroupMembershipRole = (typeof groupMembershipRoles)[number];
export const GROUP_MEMBERSHIP_ROLE = {
  member: groupMembershipRoles[1],
  owner: groupMembershipRoles[0],
} as const;

const conversation = sqliteTable(
  "conversation",
  {
    directKey: text("direct_key"),
    kind: text("kind", { enum: conversationKinds }).notNull(),
    lastMessageAt: integer("last_message_at", { mode: "timestamp_ms" }).notNull(),
    id: text("id").notNull().primaryKey(),
  },
  (table) => [
    uniqueIndex("conversation_direct_key_unique").on(table.directKey),
    index("conversation_last_message_at_idx").on(table.lastMessageAt, table.id),
  ],
);

const conversationParticipant = sqliteTable(
  "conversation_participant",
  {
    id: text("id").primaryKey().notNull(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    joinedAt: integer("joined_at", { mode: "timestamp_ms" }).notNull(),
    lastReadAt: integer("last_read_at", { mode: "timestamp_ms" }),
    memberId: text("member_id").references(() => user.id, { onDelete: "set null" }),
    memberName: text("member_name").notNull(),
  },
  (table) => [
    uniqueIndex("conversation_participant_unique").on(table.conversationId, table.memberId),
    index("conversation_participant_member_idx").on(table.memberId, table.conversationId),
  ],
);

const directMessage = sqliteTable(
  "direct_message",
  {
    id: text("id").primaryKey().notNull(),
    body: text("body").notNull(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    senderId: text("sender_id").references(() => user.id, { onDelete: "set null" }),
    senderName: text("sender_name").notNull(),
  },
  (table) => [
    index("direct_message_conversation_idx").on(table.conversationId, table.createdAt, table.id),
  ],
);

const memberGroup = sqliteTable(
  "member_group",
  {
    id: text("id").primaryKey().notNull(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    joinPolicy: text("join_policy", { enum: groupJoinPolicies }).notNull(),
    name: text("name").notNull(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [uniqueIndex("member_group_conversation_id_unique").on(table.conversationId)],
);

const groupMembership = sqliteTable(
  "group_membership",
  {
    groupId: text("group_id")
      .notNull()
      .references(() => memberGroup.id, { onDelete: "cascade" }),
    joinedAt: integer("joined_at", { mode: "timestamp_ms" }).notNull(),
    memberId: text("member_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role", { enum: groupMembershipRoles }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.groupId, table.memberId] }),
    index("group_membership_member_idx").on(table.memberId, table.groupId),
  ],
);

const groupInvite = sqliteTable(
  "group_invite",
  {
    id: text("id").primaryKey().notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    groupId: text("group_id")
      .notNull()
      .references(() => memberGroup.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
  },
  (table) => [uniqueIndex("group_invite_token_unique").on(table.token)],
);

export {
  conversation,
  conversationParticipant,
  directMessage,
  groupInvite,
  groupMembership,
  memberGroup,
};
