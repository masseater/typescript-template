import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const withdrawnMember = sqliteTable("withdrawn_member", {
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  email: text("email").notNull(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull(),
  image: text("image"),
  memberId: text("member_id").notNull().primaryKey(),
  name: text("name").notNull(),
  profile: text("profile").notNull(),
  securityVersion: integer("security_version").notNull(),
  snapshot: text("snapshot", { mode: "json" }).notNull(),
  socialLinks: text("social_links", { mode: "json" }).$type<readonly string[]>().notNull(),
  twoFactorEnabled: integer("two_factor_enabled", { mode: "boolean" }).notNull(),
  withdrawnAt: integer("withdrawn_at", { mode: "timestamp_ms" }).notNull(),
});

const leaveRequest = sqliteTable(
  "leave_request",
  {
    memberId: text("member_id")
      .notNull()
      .primaryKey()
      .references(() => withdrawnMember.memberId, { onDelete: "cascade" }),
    purgeAt: integer("purge_at", { mode: "timestamp_ms" }).notNull(),
    recoveryDeclinedAt: integer("recovery_declined_at", { mode: "timestamp_ms" }),
    requestedAt: integer("requested_at", { mode: "timestamp_ms" }).notNull(),
    restoredAt: integer("restored_at", { mode: "timestamp_ms" }),
  },
  (table) => [index("leave_request_purge_at_idx").on(table.purgeAt)],
);

export { leaveRequest, withdrawnMember };
