import { moderationKinds, reportReasons, reportStatuses, reportSubjects } from "@repo/config";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { user } from "./identity-schema.ts";

const memberBlock = sqliteTable(
  "member_block",
  {
    blockedId: text("blocked_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    blockerId: text("blocker_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.blockerId, table.blockedId] }),
    index("member_block_blocked_idx").on(table.blockedId),
  ],
);

const memberReport = sqliteTable(
  "member_report",
  {
    body: text("body").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    id: text("id").primaryKey().notNull(),
    reason: text("reason", { enum: reportReasons }).notNull(),
    reporterId: text("reporter_id").references(() => user.id, { onDelete: "set null" }),
    status: text("status", { enum: reportStatuses }).notNull(),
    subjectId: text("subject_id").notNull(),
    subjectKind: text("subject_kind", { enum: reportSubjects }).notNull(),
    targetMemberId: text("target_member_id").references(() => user.id, { onDelete: "set null" }),
  },
  (table) => [
    index("member_report_status_idx").on(table.status, table.createdAt, table.id),
    uniqueIndex("member_report_subject_unique").on(
      table.reporterId,
      table.subjectKind,
      table.subjectId,
    ),
  ],
);

const moderationAction = sqliteTable(
  "moderation_action",
  {
    actorId: text("actor_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    id: text("id").primaryKey().notNull(),
    kind: text("kind", { enum: moderationKinds }).notNull(),
    note: text("note").notNull().default(""),
    reportId: text("report_id")
      .notNull()
      .references(() => memberReport.id, { onDelete: "cascade" }),
    targetMemberId: text("target_member_id").references(() => user.id, { onDelete: "set null" }),
  },
  (table) => [index("moderation_action_report_idx").on(table.reportId, table.createdAt)],
);

export { memberBlock, memberReport, moderationAction };
