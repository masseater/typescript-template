import { groupJoinPolicies, groupMembershipRoles } from "@repo/config";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { user } from "./identity-schema.ts";
import { conversation } from "./messaging-schema.ts";

const memberGroup = sqliteTable(
  "member_group",
  {
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    id: text("id").primaryKey().notNull(),
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
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    groupId: text("group_id")
      .notNull()
      .references(() => memberGroup.id, { onDelete: "cascade" }),
    id: text("id").primaryKey().notNull(),
    token: text("token").notNull(),
  },
  (table) => [uniqueIndex("group_invite_token_unique").on(table.token)],
);

export { groupInvite, groupMembership, memberGroup };
