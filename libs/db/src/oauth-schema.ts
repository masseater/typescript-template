import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { session, user } from "./identity-schema.ts";

const jwks = sqliteTable("jwks", {
  alg: text("alg"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  crv: text("crv"),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
  id: text("id").primaryKey(),
  privateKey: text("private_key").notNull(),
  publicKey: text("public_key").notNull(),
});

const oauthClient = sqliteTable(
  "oauth_client",
  {
    applicationType: text("application_type"),
    backchannelLogoutSessionRequired: integer("backchannel_logout_session_required", {
      mode: "boolean",
    }),
    backchannelLogoutUri: text("backchannel_logout_uri"),
    clientCredentialsScopes: text("client_credentials_scopes"),
    clientDiscoveryId: text("client_discovery_id"),
    clientId: text("client_id").notNull(),
    clientSecret: text("client_secret"),
    contacts: text("contacts"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }),
    disabled: integer("disabled", { mode: "boolean" }).default(false),
    dpopBoundAccessTokens: integer("dpop_bound_access_tokens", { mode: "boolean" }).default(false),
    enableEndSession: integer("enable_end_session", { mode: "boolean" }),
    grantTypes: text("grant_types"),
    icon: text("icon"),
    id: text("id").primaryKey(),
    jwks: text("jwks"),
    jwksUri: text("jwks_uri"),
    metadata: text("metadata"),
    name: text("name"),
    policy: text("policy"),
    postLogoutRedirectUris: text("post_logout_redirect_uris"),
    redirectUris: text("redirect_uris").notNull(),
    referenceId: text("reference_id"),
    requirePKCE: integer("require_pkce", { mode: "boolean" }),
    responseTypes: text("response_types"),
    scopes: text("scopes"),
    skipConsent: integer("skip_consent", { mode: "boolean" }),
    softwareId: text("software_id"),
    softwareStatement: text("software_statement"),
    softwareVersion: text("software_version"),
    subjectType: text("subject_type"),
    tokenEndpointAuthMethod: text("token_endpoint_auth_method"),
    tos: text("tos"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
    uri: text("uri"),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  },

  (table) => [
    index("oauth_client_user_id_idx").on(table.userId),
    uniqueIndex("oauth_client_client_id_unique").on(table.clientId),
  ],
);

const oauthResource = sqliteTable(
  "oauth_resource",
  {
    accessTokenTtl: integer("access_token_ttl"),
    allowedScopes: text("allowed_scopes"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }),
    customClaims: text("custom_claims"),
    disabled: integer("disabled", { mode: "boolean" }).default(false),
    dpopBoundAccessTokensRequired: integer("dpop_bound_access_tokens_required", {
      mode: "boolean",
    }).default(false),
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    metadata: text("metadata"),
    name: text("name").notNull(),
    policyVersion: integer("policy_version").default(1),
    refreshTokenTtl: integer("refresh_token_ttl"),
    signingAlgorithm: text("signing_algorithm"),
    signingKeyId: text("signing_key_id"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  },

  (table) => [uniqueIndex("oauth_resource_identifier_unique").on(table.identifier)],
);

const oauthClientResource = sqliteTable(
  "oauth_client_resource",
  {
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }),
    id: text("id").primaryKey(),
    metadata: text("metadata"),
    resourceId: text("resource_id")
      .notNull()
      .references(() => oauthResource.identifier, { onDelete: "cascade" }),
  },

  (table) => [
    index("oauth_client_resource_client_id_idx").on(table.clientId),
    index("oauth_client_resource_resource_id_idx").on(table.resourceId),
  ],
);

const oauthRefreshToken = sqliteTable(
  "oauth_refresh_token",
  {
    authTime: integer("auth_time", { mode: "timestamp_ms" }),
    authorizationCodeId: text("authorization_code_id"),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    confirmation: text("confirmation"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    id: text("id").primaryKey(),
    referenceId: text("reference_id"),
    requestedUserInfoClaims: text("requested_user_info_claims"),
    resources: text("resources"),
    revoked: integer("revoked", { mode: "timestamp_ms" }),
    rotatedAt: integer("rotated_at", { mode: "timestamp_ms" }),
    rotationReplayExpiresAt: integer("rotation_replay_expires_at", { mode: "timestamp_ms" }),
    rotationReplayResponse: text("rotation_replay_response"),
    scopes: text("scopes").notNull(),
    sessionId: text("session_id").references(() => session.id, { onDelete: "set null" }),
    token: text("token").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },

  (table) => [
    index("oauth_refresh_token_client_id_idx").on(table.clientId),
    index("oauth_refresh_token_session_id_idx").on(table.sessionId),
    index("oauth_refresh_token_user_id_idx").on(table.userId),
    index("oauth_refresh_token_authorization_code_id_idx").on(table.authorizationCodeId),
    uniqueIndex("oauth_refresh_token_token_unique").on(table.token),
  ],
);

const oauthAccessToken = sqliteTable(
  "oauth_access_token",
  {
    authorizationCodeId: text("authorization_code_id"),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    confirmation: text("confirmation"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    id: text("id").primaryKey(),
    referenceId: text("reference_id"),
    refreshId: text("refresh_id").references(() => oauthRefreshToken.id, { onDelete: "cascade" }),
    requestedUserInfoClaims: text("requested_user_info_claims"),
    resources: text("resources"),
    revoked: integer("revoked", { mode: "timestamp_ms" }),
    scopes: text("scopes").notNull(),
    sessionId: text("session_id").references(() => session.id, { onDelete: "set null" }),
    token: text("token"),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  },

  (table) => [
    index("oauth_access_token_client_id_idx").on(table.clientId),
    index("oauth_access_token_session_id_idx").on(table.sessionId),
    index("oauth_access_token_user_id_idx").on(table.userId),
    index("oauth_access_token_authorization_code_id_idx").on(table.authorizationCodeId),
    index("oauth_access_token_refresh_id_idx").on(table.refreshId),
    uniqueIndex("oauth_access_token_token_unique").on(table.token),
  ],
);

const oauthConsent = sqliteTable(
  "oauth_consent",
  {
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }),
    id: text("id").primaryKey(),
    referenceId: text("reference_id"),
    requestedUserInfoClaims: text("requested_user_info_claims"),
    resources: text("resources"),
    scopes: text("scopes").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  },

  (table) => [
    index("oauth_consent_client_id_idx").on(table.clientId),
    index("oauth_consent_user_id_idx").on(table.userId),
  ],
);

const oauthClientAssertion = sqliteTable("oauth_client_assertion", {
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  id: text("id").primaryKey(),
});

export {
  jwks,
  oauthAccessToken,
  oauthClient,
  oauthClientAssertion,
  oauthClientResource,
  oauthConsent,
  oauthRefreshToken,
  oauthResource,
};
