import { PROFILE_VISIBILITY, applications, profileVisibilities } from "@repo/config";
import {
  ACCOUNT_STATE,
  AUTHENTICATION_METHOD,
  ROLE,
  accountPermissions,
  accountStates,
  authenticationMethods,
  roles,
} from "@repo/config/identity";
import { getAuthTables } from "better-auth/db";
import { sql } from "drizzle-orm";
import { createSelectSchema } from "drizzle-orm/effect-schema";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { Schema } from "effect";

const { session: sessionModel, user: userModel } = getAuthTables({});

if (userModel === undefined || sessionModel === undefined) {
  throw new Error("better-auth defines no user or session model");
}

const user = sqliteTable(
  userModel.modelName,
  {
    accountState: text("account_state", { enum: accountStates })
      .notNull()
      .default(ACCOUNT_STATE.active),
    companyPhotoKey: text("company_photo_key"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    email: text("email").notNull(),
    emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
    facePhotoKey: text("face_photo_key"),
    id: text("id").primaryKey(),
    image: text("image"),
    name: text("name").notNull(),
    permission: text("permission", { enum: accountPermissions }),
    profile: text("profile").notNull().default(""),
    socialLinks: text("social_links", { mode: "json" })
      .$type<readonly string[]>()
      .notNull()
      .default([]),
    role: text("role", { enum: roles }).notNull().default(ROLE.member),
    searchable: integer("searchable", { mode: "boolean" }).notNull().default(false),
    securityVersion: integer("security_version").notNull().default(0),
    twoFactorEnabled: integer("two_factor_enabled", { mode: "boolean" }).notNull().default(false),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    visibility: text("visibility", { enum: profileVisibilities })
      .notNull()
      .default(PROFILE_VISIBILITY.allMembers),
  },

  (table) => [
    uniqueIndex("user_email_unique").on(table.email),
    check("user_role", sql`${table.role} IN ('member', 'admin', 'staff')`),
    check("user_account_state", sql`${table.accountState} IN ('active', 'suspended')`),
    check(
      "user_permission",
      sql`(${table.role} = 'member' AND ${table.permission} IS NULL) OR (${table.role} = 'admin' AND ${table.permission} IN ('viewer', 'operator', 'owner')) OR (${table.role} = 'staff' AND ${table.permission} IN ('viewer', 'editor'))`,
    ),
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

const UserRow = createSelectSchema(user, {
  socialLinks: Schema.Array(Schema.String),
});

type UserRecord = typeof UserRow.Type;

export { UserRow, session, user };
export type { UserRecord };
