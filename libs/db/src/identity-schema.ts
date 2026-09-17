import { applications, authenticationMethods, roles } from "@template/config";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

const user = sqliteTable(
  "user",
  {
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    email: text("email").notNull().unique(),
    emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
    id: text("id").primaryKey(),
    image: text("image"),
    name: text("name").notNull(),
    profile: text("profile").notNull().default(""),
    role: text("role", { enum: roles }).notNull().default("user"),
    securityVersion: integer("security_version").notNull().default(0),
    twoFactorEnabled: integer("two_factor_enabled", { mode: "boolean" }).notNull().default(false),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  (table) => [check("user_role", sql`${table.role} IN ('user', 'admin')`)],
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
    token: text("token").notNull().unique(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export { session, user };
