import { applications } from "@repo/config";
import { authenticationMethods, roles } from "@repo/config/identity";
import { sql } from "drizzle-orm";
import { createSelectSchema } from "drizzle-orm/effect-schema";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const user = sqliteTable(
  "user",
  {
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    email: text("email").notNull(),
    emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
    id: text("id").primaryKey(),
    image: text("image"),
    name: text("name").notNull(),
    profile: text("profile").notNull().default(""),
    socialLinks: text("social_links", { mode: "json" })
      .$type<readonly string[]>()
      .notNull()
      .default([]),
    role: text("role", { enum: roles }).notNull().default("member"),
    securityVersion: integer("security_version").notNull().default(0),
    twoFactorEnabled: integer("two_factor_enabled", { mode: "boolean" }).notNull().default(false),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("user_email_unique").on(table.email),
    check("user_role", sql`${table.role} IN ('member', 'admin')`),
  ],
);

const session = sqliteTable(
  "session",
  {
    audience: text("audience", { enum: applications }).notNull(),
    authenticatedAt: integer("authenticated_at", { mode: "timestamp_ms" }),
    authenticationMethod: text("authentication_method", { enum: authenticationMethods })
      .notNull()
      .default("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    id: text("id").primaryKey(),
    ipAddress: text("ip_address"),
    securityVersion: integer("security_version").notNull(),
    token: text("token").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("session_user_id_idx").on(table.userId),
    uniqueIndex("session_token_unique").on(table.token),
  ],
);

const UserRow = createSelectSchema(user);

type UserRecord = typeof UserRow.Type;

export { UserRow, session, user };
export type { UserRecord };
