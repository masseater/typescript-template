import {
  ACCOUNT_STATE,
  AUTHENTICATION_METHOD,
  ROLE,
  accountPermissions,
  accountStates,
  applications,
  authenticationMethods,
  roles,
} from "@repo/config";
import { getAuthTables } from "better-auth/db";
import { sql } from "drizzle-orm";
import { createSelectSchema } from "drizzle-orm/effect-schema";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const { session: sessionModel, user: userModel } = getAuthTables({});

if (userModel === undefined || sessionModel === undefined) {
  throw new Error("better-auth defines no user or session model");
}

const user = sqliteTable(
  userModel.modelName,
  {
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    email: text("email").notNull(),
    emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
    id: text("id").primaryKey(),
    image: text("image"),
    name: text("name").notNull(),
    permission: text("permission", { enum: accountPermissions }),
    profile: text("profile").notNull().default(""),
    accountState: text("account_state", { enum: accountStates })
      .notNull()
      .default(ACCOUNT_STATE.active),
    socialLinks: text("social_links", { mode: "json" })
      .$type<readonly string[]>()
      .notNull()
      .default([]),
    role: text("role", { enum: roles }).notNull().default(ROLE.member),
    securityVersion: integer("security_version").notNull().default(0),
    twoFactorEnabled: integer("two_factor_enabled", { mode: "boolean" }).notNull().default(false),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },

  (table) => [
    uniqueIndex("user_email_unique").on(table.email),
    check("user_role", sql`${table.role} IN ('member', 'admin', 'staff')`),
    check(
      "user_permission",
      sql`(
        (${table.role} = 'member' AND ${table.permission} IS NULL) OR
        (${table.role} = 'admin' AND ${table.permission} IN ('view', 'operate', 'manage')) OR
        (${table.role} = 'staff' AND ${table.permission} IN ('view', 'edit'))
      )`,
    ),
    check("user_account_state", sql`${table.accountState} IN ('active', 'suspended', 'left')`),
  ],
);

const session = sqliteTable(
  sessionModel.modelName,
  {
    audience: text("audience", { enum: applications }).notNull(),
    authenticatedAt: integer("authenticated_at", { mode: "timestamp_ms" }),
    authenticationMethod: text("authentication_method", { enum: authenticationMethods })
      .notNull()
      .default(AUTHENTICATION_METHOD.password),
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
