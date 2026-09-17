import { and, count, eq, gt } from "drizzle-orm";
import { Effect, Schema } from "effect";
import { query } from "./index.ts";
import type { Audience } from "./index.ts";
import {
  oauthAccessToken,
  oauthRefreshToken,
  passkey,
  session,
  twoFactor,
  user,
  verification,
} from "./schema.ts";

export class SessionRevoked extends Schema.TaggedError<SessionRevoked>()("SessionRevoked", {}) {}

export const hasVerificationAudience = Effect.fn("hasVerificationAudience")(function* (
  identifier: string,
  audience: Audience,
) {
  const [record] = yield* query((database) =>
    database
      .select({ id: verification.id })
      .from(verification)
      .where(
        and(
          eq(verification.identifier, identifier),
          eq(verification.audience, audience),
          gt(verification.expiresAt, new Date()),
        ),
      )
      .limit(1),
  );
  return record !== undefined;
});

export const findUser = Effect.fn("findUser")(function* (userId: string) {
  const [record] = yield* query((database) =>
    database.select().from(user).where(eq(user.id, userId)).limit(1),
  );
  return record ?? null;
});

export const findPasskeyUser = Effect.fn("findPasskeyUser")(function* (
  credentialId: string,
  audience: Audience,
) {
  const [record] = yield* query((database) =>
    database
      .select({ user })
      .from(passkey)
      .innerJoin(user, eq(passkey.userId, user.id))
      .where(and(eq(passkey.credentialID, credentialId), eq(passkey.audience, audience)))
      .limit(1),
  );
  return record?.user ?? null;
});

export const hasEnrolledFactor = Effect.fn("hasEnrolledFactor")(function* (
  userId: string,
  audience: Audience,
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

export const getSessionSecurity = Effect.fn("getSessionSecurity")(function* (
  sessionId: string,
  audience: Audience,
) {
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
          gt(session.expiresAt, new Date()),
        ),
      )
      .limit(1),
  );
  return record ?? null;
});

export const markSessionStrong = Effect.fn("markSessionStrong")(function* (
  sessionId: string,
  audience: Audience,
  method: "password_totp" | "passkey_uv",
) {
  const [updated] = yield* query((database) =>
    database
      .update(session)
      .set({ authenticationMethod: method, authenticatedAt: new Date() })
      .where(and(eq(session.id, sessionId), eq(session.audience, audience)))
      .returning({ id: session.id }),
  );
  if (!updated) return yield* new SessionRevoked();
});

export const revokeUserSessions = Effect.fn("revokeUserSessions")(function* (userId: string) {
  yield* query((database) =>
    database.delete(oauthAccessToken).where(eq(oauthAccessToken.userId, userId)),
  );
  yield* query((database) =>
    database.delete(oauthRefreshToken).where(eq(oauthRefreshToken.userId, userId)),
  );
  yield* query((database) => database.delete(session).where(eq(session.userId, userId)));
});

export const findWikiReader = Effect.fn("findWikiReader")(function* (userId: string) {
  const [record] = yield* query((database) =>
    database
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.id, userId), eq(user.role, "admin"), eq(user.emailVerified, true)))
      .limit(1),
  );
  return record ?? null;
});
