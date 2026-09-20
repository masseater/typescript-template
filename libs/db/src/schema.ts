import { AUTHENTICATION_METHOD, accountPermissions, applications } from "@repo/config";
import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { session, user } from "./identity-schema.ts";
import { interview } from "./interview-schema.ts";
import { follow, memberOnboarding } from "./member-social-schema.ts";
import {
  jwks,
  oauthAccessToken,
  oauthClient,
  oauthClientAssertion,
  oauthClientResource,
  oauthConsent,
  oauthRefreshToken,
  oauthResource,
} from "./oauth-schema.ts";

const account = sqliteTable(
  "account",
  {
    accessToken: text("access_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
    accountId: text("account_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    id: text("id").primaryKey(),
    idToken: text("id_token"),
    password: text(AUTHENTICATION_METHOD.password),
    providerId: text("provider_id").notNull(),
    refreshToken: text("refresh_token"),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
    scope: text("scope"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },

  (table) => [index("account_user_id_idx").on(table.userId)],
);

const verification = sqliteTable(
  "verification",
  {
    audience: text("audience", { enum: applications }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    value: text("value").notNull(),
  },

  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

const twoFactor = sqliteTable(
  "two_factor",
  {
    backupCodes: text("backup_codes").notNull(),
    failedVerificationCount: integer("failed_verification_count").notNull().default(0),
    id: text("id").primaryKey(),
    lockedUntil: integer("locked_until", { mode: "timestamp_ms" }),
    secret: text("secret").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    verified: integer("verified", { mode: "boolean" }).notNull().default(false),
  },

  (table) => [uniqueIndex("two_factor_user_id_idx").on(table.userId)],
);

const passkey = sqliteTable(
  "passkey",
  {
    aaguid: text("aaguid"),
    audience: text("audience", { enum: applications }).notNull(),
    backedUp: integer("backed_up", { mode: "boolean" }).notNull(),
    counter: integer("counter").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }),
    credentialID: text("credential_id").notNull(),
    deviceType: text("device_type").notNull(),
    id: text("id").primaryKey(),
    name: text("name"),
    publicKey: text("public_key").notNull(),
    transports: text("transports"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },

  (table) => [
    index("passkey_user_id_idx").on(table.userId),
    uniqueIndex("passkey_credential_id_unique").on(table.credentialID),
  ],
);

const rateLimit = sqliteTable(
  "rate_limit",
  {
    count: integer("count").notNull(),
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    lastRequest: integer("last_request").notNull(),
  },

  (table) => [uniqueIndex("rate_limit_key_unique").on(table.key)],
);

/** @canonical-values db.audit-action */
export const auditActions = [
  "role_changed",
  "user_deleted",
  "admin_invited",
  "admin_permission_changed",
  "admin_disabled",
  "member_suspended",
  "member_unsuspended",
  "staff_invited",
  "staff_removed",
  "staff_permission_changed",
  "flag_changed",
] as const;
export type AuditAction = (typeof auditActions)[number];
export const AUDIT_ACTION = {
  adminDisabled: auditActions[4],
  adminInvited: auditActions[2],
  adminPermissionChanged: auditActions[3],
  flagChanged: auditActions[10],
  memberSuspended: auditActions[5],
  memberUnsuspended: auditActions[6],
  roleChanged: auditActions[0],
  staffInvited: auditActions[7],
  staffPermissionChanged: auditActions[9],
  staffRemoved: auditActions[8],
  userDeleted: auditActions[1],
} as const;

const auditEvent = sqliteTable(
  "audit_event",
  {
    action: text("action", { enum: auditActions }).notNull(),
    actorId: text("actor_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    id: text("id").primaryKey(),
    targetId: text("target_id").notNull(),
  },

  (table) => [index("audit_event_created_at_idx").on(table.createdAt)],
);

const featureFlag = sqliteTable("feature_flag", {
  enabled: integer("enabled", { mode: "boolean" }).notNull(),
  flagKey: text("flag_key").primaryKey(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

const flagChange = sqliteTable(
  "flag_change",
  {
    actorId: text("actor_id")
      .notNull()
      .references(() => user.id),
    changedAt: integer("changed_at", { mode: "timestamp_ms" }).notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull(),
    flagKey: text("flag_key")
      .notNull()
      .references(() => featureFlag.flagKey),
    id: text("id").primaryKey(),
  },
  (table) => [index("flag_change_flag_key_idx").on(table.flagKey)],
);

const invite = sqliteTable(
  "invite",
  {
    acceptedAt: integer("accepted_at", { mode: "timestamp_ms" }),
    audience: text("audience", { enum: applications }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    email: text("email").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    id: text("id").primaryKey(),
    inviterId: text("inviter_id")
      .notNull()
      .references(() => user.id),
    permission: text("permission", { enum: accountPermissions }).notNull(),
    tokenHash: text("token_hash").notNull(),
  },
  (table) => [
    uniqueIndex("invite_token_hash_unique").on(table.tokenHash),
    uniqueIndex("invite_open_email").on(table.audience, table.email).where(sql`${table.acceptedAt} IS NULL`),
  ],
);

const schema = {
  account,
  auditEvent,
  featureFlag,
  flagChange,
  follow,
  interview,
  invite,
  memberOnboarding,
  jwks,
  oauthAccessToken,
  oauthClient,
  oauthClientAssertion,
  oauthClientResource,
  oauthConsent,
  oauthRefreshToken,
  oauthResource,
  passkey,
  rateLimit,
  session,
  twoFactor,
  user,
  verification,
};

export {
  account,
  auditEvent,
  featureFlag,
  flagChange,
  invite,
  passkey,
  rateLimit,
  schema,
  twoFactor,
  verification,
};
export {
  jwks,
  oauthAccessToken,
  oauthClient,
  oauthClientAssertion,
  oauthClientResource,
  oauthConsent,
  oauthRefreshToken,
  oauthResource,
} from "./oauth-schema.ts";
export { session, user } from "./identity-schema.ts";
export { interview } from "./interview-schema.ts";
export { follow, memberOnboarding, onboardingSteps } from "./member-social-schema.ts";
