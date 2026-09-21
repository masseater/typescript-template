import { type Application } from "@repo/config";
import { ACCOUNT_STATE, ROLE, type StrongAuthenticationMethod } from "@repo/config/identity";
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

class SessionRevoked extends Schema.TaggedError<SessionRevoked>()("SessionRevoked", {}) {}

export const hasVerificationAudience = Effect.fn("hasVerificationAudience")(
  function* hasVerificationAudience(identifier: string, audience: Application) {
    const checkedAt = new Date();

    const [pendingVerification] = yield* query((database) =>
      database
        .select({ id: verification.id })
        .from(verification)
        .where(
          and(
            eq(verification.identifier, identifier),
            eq(verification.audience, audience),
            gt(verification.expiresAt, checkedAt),
          ),
        )
        .limit(1),
    );
    return pendingVerification !== undefined;
  },
);

export const findUser = Effect.fn("findUser")(function* findUser(userId: string) {
  const [foundUser] = yield* query((database) =>
    database.select().from(user).where(eq(user.id, userId)).limit(1),
  );

  return foundUser;
});

export const findPasskeyUser = Effect.fn("findPasskeyUser")(function* findPasskeyUser(
  credentialId: string,
  audience: Application,
) {
  const [passkeyOwner] = yield* query((database) =>
    database
      .select({ user })
      .from(passkey)
      .innerJoin(user, eq(passkey.userId, user.id))
      .where(and(eq(passkey.credentialID, credentialId), eq(passkey.audience, audience)))
      .limit(1),
  );

  return passkeyOwner?.user;
});

export const hasEnrolledFactor = Effect.fn("hasEnrolledFactor")(function* hasEnrolledFactor(
  userId: string,
  audience: Application,
) {
  const [passkeyCount] = yield* query((database) =>
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
  return (passkeyCount?.count ?? 0) > 0 || totp !== undefined;
});

export const getSessionSecurity = Effect.fn("getSessionSecurity")(function* getSessionSecurity(
  sessionId: string,
  audience: Application,
) {
  const checkedAt = new Date();

  const [liveSession] = yield* query((database) =>
    database
      .select({ session, user })
      .from(session)
      .innerJoin(user, eq(session.userId, user.id))
      .where(
        and(
          eq(session.id, sessionId),
          eq(session.audience, audience),
          eq(session.securityVersion, user.securityVersion),
          gt(session.expiresAt, checkedAt),
        ),
      )
      .limit(1),
  );

  return liveSession;
});

export const lookupSessionByToken = Effect.fn("lookupSessionByToken")(
  function* lookupSessionByToken(token: string) {
    const [matchedSession] = yield* query((database) =>
      database
        .select({ session, user })
        .from(session)
        .innerJoin(user, eq(session.userId, user.id))
        .where(eq(session.token, token))
        .limit(1),
    );

    return matchedSession;
  },
);

export const markSessionStrong = Effect.fn("markSessionStrong")(
  function* markSessionStrong(strengthened: {
    readonly sessionId: string;
    readonly audience: Application;
    readonly method: StrongAuthenticationMethod;
  }) {
    const { audience, method, sessionId } = strengthened;
    const [strongSession] = yield* query((database) =>
      database
        .update(session)
        .set({ authenticatedAt: new Date(), authenticationMethod: method })
        .where(and(eq(session.id, sessionId), eq(session.audience, audience)))
        .returning({ id: session.id }),
    );
    if (!strongSession) {
      return yield* new SessionRevoked();
    }
  },
);

export const revokeUserSessions = Effect.fn("revokeUserSessions")(function* revokeUserSessions(
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

export const findWikiReader = Effect.fn("findWikiReader")(function* findWikiReader(userId: string) {
  const [wikiReader] = yield* query((database) =>
    database
      .select({ id: user.id })
      .from(user)
      .where(
        and(
          eq(user.id, userId),
          eq(user.role, ROLE.staff),
          eq(user.accountState, ACCOUNT_STATE.active),
          eq(user.emailVerified, true),
        ),
      )
      .limit(1),
  );

  return wikiReader;
});

export const claimMailSlot = Effect.fn("claimMailSlot")(function* claimMailSlot({
  audience,
  identifier,
  until,
}: {
  readonly audience: Application;
  readonly identifier: string;
  readonly until: Date;
}) {
  const claimedAt = new Date();
  yield* query((database) =>
    database
      .delete(verification)
      .where(and(eq(verification.identifier, identifier), lte(verification.expiresAt, claimedAt))),
  );
  if (yield* hasVerificationAudience(identifier, audience)) {
    return false;
  }
  yield* query((database) =>
    database.insert(verification).values({
      audience,
      createdAt: claimedAt,
      expiresAt: until,
      id: crypto.randomUUID(),
      identifier,
      updatedAt: claimedAt,
      value: "",
    }),
  );
  return true;
});
