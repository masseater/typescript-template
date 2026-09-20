import { type Application } from "@repo/config";
import { AUTHENTICATION_METHOD, ROLE, type Role } from "@repo/config/identity";
import { eq } from "drizzle-orm";
import { Effect } from "effect";

import { query, type Database } from "./database.ts";
import {
  account,
  oauthAccessToken,
  oauthClient,
  oauthConsent,
  oauthRefreshToken,
  session,
  user,
} from "./schema.ts";

import type { DatabaseFailure } from "./database-failure.ts";

export const recordedAt = new Date("2026-01-01T00:00:00.000Z");

export const addUser = (added: {
  readonly userId: string;
  readonly role?: Role;
  readonly emailVerified?: boolean;
}): Effect.Effect<void, DatabaseFailure, Database> => {
  return query(async (database): Promise<void> => {
    await database.insert(user).values({
      createdAt: recordedAt,
      email: `${added.userId}@example.com`,
      emailVerified: added.emailVerified ?? true,
      id: added.userId,
      name: added.userId,
      role: added.role ?? ROLE.member,
      updatedAt: recordedAt,
    });
  });
};

export const addCredential = (userId: string): Effect.Effect<void, DatabaseFailure, Database> => {
  return query(async (database): Promise<void> => {
    await database.insert(account).values({
      accountId: userId,
      createdAt: new Date(),
      id: `credential-${userId}`,
      password: "not-used-for-authentication-in-db-test",
      providerId: "credential",
      updatedAt: new Date(),
      userId,
    });
  });
};

const SESSION_LIFETIME_MS = 60_000;

export const addSession = Effect.fn("addSession")(function* addSession(opened: {
  readonly userId: string;
  readonly audience: Application;
  readonly strong?: boolean;
}) {
  const sessionId = crypto.randomUUID();
  const owners = yield* query(async (database) =>
    database.select().from(user).where(eq(user.id, opened.userId)),
  );
  const securityVersion = owners.at(0)?.securityVersion ?? 0;
  yield* query(async (database): Promise<void> => {
    await database.insert(session).values({
      audience: opened.audience,
      authenticationMethod:
        opened.strong === false
          ? AUTHENTICATION_METHOD.password
          : AUTHENTICATION_METHOD.passwordTotp,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + SESSION_LIFETIME_MS),
      id: sessionId,
      securityVersion,
      token: crypto.randomUUID(),
      updatedAt: new Date(),
      userId: opened.userId,
    });
  });
  return sessionId;
});

export const addOAuthGrant = Effect.fn("addOAuthGrant")(function* addOAuthGrant(userId: string) {
  const clientId = `client-${userId}`;
  const scopes = '["wiki:read"]';
  yield* query(async (database): Promise<void> => {
    await database.batch([
      database.insert(oauthClient).values({ clientId, id: clientId, redirectUris: "[]" }),
      database.insert(oauthRefreshToken).values({
        clientId,
        id: `refresh-${userId}`,
        scopes,
        token: `refresh-token-${userId}`,
        userId,
      }),
      database.insert(oauthAccessToken).values({
        clientId,
        id: `access-${userId}`,
        refreshId: `refresh-${userId}`,
        scopes,
        token: `access-token-${userId}`,
        userId,
      }),
      database.insert(oauthConsent).values({ clientId, id: `consent-${userId}`, scopes, userId }),
    ]);
  });
});

export const oauthGrantCounts = Effect.fn("oauthGrantCounts")(function* oauthGrantCounts(
  userId: string,
) {
  const access = yield* query(async (database) =>
    database.select().from(oauthAccessToken).where(eq(oauthAccessToken.userId, userId)),
  );
  const refresh = yield* query(async (database) =>
    database.select().from(oauthRefreshToken).where(eq(oauthRefreshToken.userId, userId)),
  );
  const consent = yield* query(async (database) =>
    database.select().from(oauthConsent).where(eq(oauthConsent.userId, userId)),
  );
  return { access: access.length, consent: consent.length, refresh: refresh.length };
});
