import { notificationKinds } from "@repo/config";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./identity-schema.ts";

const notification = sqliteTable(
  "notification",
  {
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    actorName: text("actor_name"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    id: text("id").primaryKey(),
    kind: text("kind", { enum: notificationKinds }).notNull(),
    memberId: text("member_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    readAt: integer("read_at", { mode: "timestamp_ms" }),
    subjectId: text("subject_id").notNull(),
    title: text("title"),
  },
  (table) => [index("notification_member_id_idx").on(table.memberId, table.createdAt, table.id)],
);

const notificationPreference = sqliteTable("notification_preference", {
  boardMail: integer("board_mail", { mode: "boolean" }).notNull().default(false),
  memberId: text("member_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  messageMail: integer("message_mail", { mode: "boolean" }).notNull().default(false),
});

export { notification, notificationPreference };
