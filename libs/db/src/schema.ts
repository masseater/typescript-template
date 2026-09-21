import { AUTHENTICATION_METHOD, applications } from "@repo/config";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { agreementAcceptance, agreementVersion } from "./agreement-schema.ts";
import { apikey } from "./api-key-schema.ts";
import { planSubscription, stripeEvent } from "./billing-schema.ts";
import { boardPost, boardThread } from "./board-schema.ts";
import { auditActions, clientKinds, metricKeys, metricPeriods } from "./dashboard-literals.ts";
import { session, user } from "./identity-schema.ts";
import { interview } from "./interview-schema.ts";
import { leaveRequest, withdrawnMember } from "./member-leave-schema.ts";
import { follow, memberOnboarding } from "./member-social-schema.ts";
import { conversation, conversationParticipant, directMessage } from "./messaging-schema.ts";
import { notification, notificationPreference } from "./notification-schema.ts";
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

export type AuditAction = (typeof auditActions)[number];
export type MetricKey = (typeof metricKeys)[number];
export type MetricPeriod = (typeof metricPeriods)[number];

const metricSnapshot = sqliteTable(
  "metric_snapshot",
  {
    bucket: text("bucket").notNull(),
    clientKind: text("client_kind", { enum: clientKinds }).notNull(),
    computedAt: integer("computed_at", { mode: "timestamp_ms" }).notNull(),
    id: text("id").primaryKey().notNull(),
    metric: text("metric", { enum: metricKeys }).notNull(),
    period: text("period", { enum: metricPeriods }).notNull(),
    value: integer("value").notNull(),
  },

  (table) => [
    index("metric_snapshot_metric_period_bucket_idx").on(table.metric, table.period, table.bucket),
    uniqueIndex("metric_snapshot_unique").on(
      table.metric,
      table.period,
      table.bucket,
      table.clientKind,
    ),
  ],
);

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

const schema = {
  account,
  agreementAcceptance,
  agreementVersion,
  apikey,
  auditEvent,
  boardPost,
  boardThread,
  conversation,
  conversationParticipant,
  directMessage,
  metricSnapshot,
  follow,
  interview,
  leaveRequest,
  memberOnboarding,
  notification,
  notificationPreference,
  withdrawnMember,
  jwks,
  oauthAccessToken,
  oauthClient,
  oauthClientAssertion,
  oauthClientResource,
  oauthConsent,
  oauthRefreshToken,
  oauthResource,
  passkey,
  planSubscription,
  rateLimit,
  session,
  stripeEvent,
  twoFactor,
  user,
  verification,
};

export {
  account,
  apikey,
  auditEvent,
  metricSnapshot,
  passkey,
  rateLimit,
  schema,
  twoFactor,
  verification,
};
export { agreementAcceptance, agreementVersion } from "./agreement-schema.ts";
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
export { boardPost, boardThread } from "./board-schema.ts";
export { conversation, conversationParticipant, directMessage } from "./messaging-schema.ts";
export { session, user } from "./identity-schema.ts";
export { interview } from "./interview-schema.ts";
export { leaveRequest, withdrawnMember } from "./member-leave-schema.ts";
export { planSubscription, stripeEvent } from "./billing-schema.ts";
export { follow, memberOnboarding, onboardingSteps } from "./member-social-schema.ts";
export { notification, notificationPreference } from "./notification-schema.ts";
export { NOTIFICATION_KIND, notificationKinds } from "@repo/config";
export type { NotificationKind } from "@repo/config";
