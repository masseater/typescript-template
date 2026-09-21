import { INQUIRY_STATUS, inquiryStatuses, roles, type InquiryStatus } from "@repo/config";
import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./identity-schema.ts";

export type InquiryAuthorKind = (typeof roles)[number];
export const INQUIRY_AUTHOR_KIND = { admin: roles[1], member: roles[0] } as const;
export const inquiryAuthorKinds = roles;

const inquiry = sqliteTable(
  "inquiry",
  {
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    id: text("id").primaryKey().notNull(),
    memberId: text("member_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status", { enum: inquiryStatuses }).notNull().default(INQUIRY_STATUS.open),
    subject: text("subject").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("inquiry_member_id_idx").on(table.memberId),
    index("inquiry_status_idx").on(table.status),
    index("inquiry_updated_at_idx").on(table.updatedAt),
    check("inquiry_status", sql`${table.status} IN ('open', 'answered', 'closed')`),
  ],
);

const inquiryMessage = sqliteTable(
  "inquiry_message",
  {
    authorId: text("author_id").notNull(),
    authorKind: text("author_kind", { enum: roles }).notNull(),
    body: text("body").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    id: text("id").primaryKey().notNull(),
    inquiryId: text("inquiry_id")
      .notNull()
      .references(() => inquiry.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("inquiry_message_inquiry_id_idx").on(table.inquiryId),
    check("inquiry_message_author_kind", sql`${table.authorKind} IN ('member', 'admin')`),
  ],
);

export { inquiry, inquiryMessage };
