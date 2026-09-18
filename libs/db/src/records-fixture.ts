import type { Application, Role } from "@template/config";
import { Effect, Exit } from "effect";
import {
  account,
  oauthAccessToken,
  oauthClient,
  oauthConsent,
  oauthRefreshToken,
  session,
  user,
} from "./schema.ts";
import type { Database } from "./database.ts";
import type { DatabaseFailure } from "./database-failure.ts";
import { eq } from "drizzle-orm";
import { query } from "./database.ts";

type Records = Effect.Effect<void, DatabaseFailure, Database>;

const SESSION_LIFETIME_MS = 60_000;

function addUser(id: string, role: Role = "user", emailVerified = true): Records {
  return query(async (database): Promise<void> => {
    await database.insert(user).values({
      createdAt: new Date(),
      email: `${id}@example.com`,
      emailVerified,
      id,
      name: id,
      role,
      updatedAt: new Date(),
    });
  });
}

function addCredential(userId: string): Records {
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
}

const insertSession = Effect.fn("insertSession")(function* insertSession(
  userId: string,
  audience: Application,
  strong: boolean,
) {
  const id = crypto.randomUUID();
  const owners = yield* query(async (database) =>
    database.select().from(user).where(eq(user.id, userId)),
  );
  const securityVersion = owners.at(0)?.securityVersion ?? 0;
  yield* query(async (database): Promise<void> => {
    await database.insert(session).values({
      audience,
      authenticationMethod: strong ? "password_totp" : "password",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + SESSION_LIFETIME_MS),
      id,
      securityVersion,
      token: crypto.randomUUID(),
      updatedAt: new Date(),
      userId,
    });
  });
  return id;
});

function addSession(
  userId: string,
  audience: Application,
  strong = true,
): Effect.Effect<string, DatabaseFailure, Database> {
  return insertSession(userId, audience, strong);
}

function failureTag<Value, Failure extends { readonly _tag: string }, Requirements>(
  effect: Effect.Effect<Value, Failure, Requirements>,
): Effect.Effect<string, Value, Requirements> {
  return effect.pipe(
    Effect.flip,
    Effect.map((failure) => failure._tag),
  );
}

function successCount<Value, Failure>(outcomes: readonly Exit.Exit<Value, Failure>[]): number {
  return outcomes.filter((outcome) => Exit.isSuccess(outcome)).length;
}

const addOAuthGrant = Effect.fn("addOAuthGrant")(function* addOAuthGrant(userId: string) {
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

const oauthGrantCounts = Effect.fn("oauthGrantCounts")(function* oauthGrantCounts(userId: string) {
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

export {
  addCredential,
  addOAuthGrant,
  addSession,
  addUser,
  failureTag,
  oauthGrantCounts,
  successCount,
};
