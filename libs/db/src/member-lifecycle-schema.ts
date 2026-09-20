import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { user } from "./identity-schema.ts";

const withdrawnMember = sqliteTable(
  "withdrawn_member",
  {
    email: text("email").notNull(),
    id: text("id").primaryKey(),
    purgeAt: integer("purge_at", { mode: "timestamp_ms" }).notNull(),
    requestedAt: integer("requested_at", { mode: "timestamp_ms" }).notNull(),
    snapshot: text("snapshot").notNull(),
  },
  (table) => [uniqueIndex("withdrawn_member_email_unique").on(table.email)],
);

const emailChange = sqliteTable(
  "email_change",
  {
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    id: text("id").primaryKey(),
    nextEmail: text("next_email").notNull(),
    tokenHash: text("token_hash").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("email_change_next_email_unique").on(table.nextEmail),
    uniqueIndex("email_change_token_hash_unique").on(table.tokenHash),
    uniqueIndex("email_change_user_id_unique").on(table.userId),
  ],
);

const memberApiKey = sqliteTable(
  "member_api_key",
  {
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    id: text("id").primaryKey(),
    token: text("token").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [uniqueIndex("member_api_key_token_unique").on(table.token)],
);

const memberMessage = sqliteTable(
  "member_message",
  {
    body: text("body").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    id: text("id").primaryKey(),
    recipientId: text("recipient_id").notNull(),
    senderId: text("sender_id").notNull(),
  },
  (table) => [index("member_message_recipient_id_idx").on(table.recipientId)],
);

export { emailChange, memberApiKey, memberMessage, withdrawnMember };
