import { and, count, eq, gt, lte } from "drizzle-orm";
import { Effect, Schema } from "effect";

import { query } from "./database.ts";
import {
  oauthAccessToken,
  oauthRefreshToken,
  passkey,
  session,
  twoFactor,
  user,
  verification,
} from "./schema.ts";

import type { Application, StrongAuthenticationMethod } from "@repo/config";

class SessionRevoked extends Schema.TaggedError<SessionRevoked>()("SessionRevoked", {}) {}

const hasVerificationAudience = Effect.fn("hasVerificationAudience")(
  function* hasVerificationAudience(identifier: string, audience: Application) {
    const now = new Date();
    const [record] = yield* query((database) =>
      database
        .select({ id: verification.id })
        .from(verification)
        .where(
          and(
            eq(verification.identifier, identifier),
            eq(verification.audience, audience),
            gt(verification.expiresAt, now),
          ),
        )
        .limit(1),
    );
    return record !== undefined;
  },
);

const findUser = Effect.fn("findUser")(function* findUser(userId: string) {
  const [record] = yield* query((database) =>
    database.select().from(user).where(eq(user.id, userId)).limit(1),
  );
  // oxlint-disable-next-line unicorn/no-null
  return record ?? null;
});

const findPasskeyUser = Effect.fn("findPasskeyUser")(function* findPasskeyUser(
  credentialId: string,
  audience: Application,
) {
  const [record] = yield* query((database) =>
    database
      .select({ user })
      .from(passkey)
      .innerJoin(user, eq(passkey.userId, user.id))
      .where(and(eq(passkey.credentialID, credentialId), eq(passkey.audience, audience)))
      .limit(1),
  );
  // oxlint-disable-next-line unicorn/no-null
  return record?.user ?? null;
});

const hasEnrolledFactor = Effect.fn("hasEnrolledFactor")(function* hasEnrolledFactor(
  userId: string,
  audience: Application,
) {
  const [keys] = yield* query((database) =>
    database
      .select({ count: count() })
      .from(passkey)
      .where(and(eq(passkey.userId, userId), eq(passkey.audience, audience))),
  );
  const [totp] = yield* query((database) =>
    database
      .select({ id: twoFactor.id })
      .from(twoFactor)
      .where(and(eq(twoFactor.userId, userId), eq(twoFactor.verified, true)))
      .limit(1),
  );
  return (keys?.count ?? 0) > 0 || totp !== undefined;
});

const getSessionSecurity = Effect.fn("getSessionSecurity")(function* getSessionSecurity(
  sessionId: string,
  audience: Application,
) {
  const now = new Date();
  const [record] = yield* query((database) =>
    database
      .select({ session, user })
      .from(session)
      .innerJoin(user, eq(session.userId, user.id))
      .where(
        and(
          eq(session.id, sessionId),
          eq(session.audience, audience),
          eq(session.securityVersion, user.securityVersion),
          gt(session.expiresAt, now),
        ),
      )
      .limit(1),
  );
  // oxlint-disable-next-line unicorn/no-null
  return record ?? null;
});

const markSessionStrong = Effect.fn("markSessionStrong")(function* markSessionStrong(
  sessionId: string,
  audience: Application,
  method: StrongAuthenticationMethod,
) {
  const [updated] = yield* query((database) =>
    database
      .update(session)
      .set({ authenticatedAt: new Date(), authenticationMethod: method })
      .where(and(eq(session.id, sessionId), eq(session.audience, audience)))
      .returning({ id: session.id }),
  );
  if (!updated) {
    return yield* new SessionRevoked();
  }
});

const revokeUserSessions = Effect.fn("revokeUserSessions")(function* revokeUserSessions(
  userId: string,
) {
  yield* query(async (database): Promise<void> => {
    await database.batch([
      database.delete(oauthAccessToken).where(eq(oauthAccessToken.userId, userId)),
      database.delete(oauthRefreshToken).where(eq(oauthRefreshToken.userId, userId)),
      database.delete(session).where(eq(session.userId, userId)),
    ]);
  });
});

const findWikiReader = Effect.fn("findWikiReader")(function* findWikiReader(userId: string) {
  const [record] = yield* query((database) =>
    database
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.id, userId), eq(user.role, "admin"), eq(user.emailVerified, true)))
      .limit(1),
  );
  // oxlint-disable-next-line unicorn/no-null
  return record ?? null;
});

const claimMailSlot = Effect.fn("claimMailSlot")(function* claimMailSlot(
  identifier: string,
  audience: Application,
  until: Date,
) {
  const now = new Date();
  yield* query((database) =>
    database
      .delete(verification)
      .where(and(eq(verification.identifier, identifier), lte(verification.expiresAt, now))),
  );
  if (yield* hasVerificationAudience(identifier, audience)) {
    return false;
  }
  yield* query((database) =>
    database.insert(verification).values({
      audience,
      createdAt: now,
      expiresAt: until,
      id: crypto.randomUUID(),
      identifier,
      updatedAt: now,
      value: "",
    }),
  );
  return true;
});

export {
  SessionRevoked,
  claimMailSlot,
  findPasskeyUser,
  findUser,
  findWikiReader,
  getSessionSecurity,
  hasEnrolledFactor,
  hasVerificationAudience,
  markSessionStrong,
  revokeUserSessions,
};
