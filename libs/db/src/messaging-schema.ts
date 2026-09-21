import { conversationKinds } from "@repo/config";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { user } from "./identity-schema.ts";

const conversation = sqliteTable(
  "conversation",
  {
    id: text("id").primaryKey().notNull(),
    directKey: text("direct_key"),
    kind: text("kind", { enum: conversationKinds }).notNull(),
    lastMessageAt: integer("last_message_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("conversation_direct_key_unique").on(table.directKey),
    index("conversation_last_message_at_idx").on(table.lastMessageAt, table.id),
  ],
);

const conversationParticipant = sqliteTable(
  "conversation_participant",
  {
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

export { conversation, conversationParticipant, directMessage };
