import { and, count, eq, gt } from "drizzle-orm";
import type { Audience, Database } from "./index.ts";
import {
  oauthAccessToken,
  oauthRefreshToken,
  passkey,
  session,
  twoFactor,
  user,
  verification,
} from "./schema.ts";

export async function hasVerificationAudience(
  database: Database,
  identifier: string,
  audience: Audience,
) {
  const [record] = await database
    .select({ id: verification.id })
    .from(verification)
    .where(
      and(
        eq(verification.identifier, identifier),
        eq(verification.audience, audience),
        gt(verification.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return record !== undefined;
}

export async function findUser(database: Database, userId: string) {
  const [record] = await database.select().from(user).where(eq(user.id, userId)).limit(1);
  return record ?? null;
}

export async function findPasskeyUser(
  database: Database,
  credentialId: string,
  audience: Audience,
) {
  const [record] = await database
    .select({ user })
    .from(passkey)
    .innerJoin(user, eq(passkey.userId, user.id))
    .where(and(eq(passkey.credentialID, credentialId), eq(passkey.audience, audience)))
    .limit(1);
  return record?.user ?? null;
}

export async function hasEnrolledFactor(database: Database, userId: string, audience: Audience) {
  const [keys] = await database
    .select({ count: count() })
    .from(passkey)
    .where(and(eq(passkey.userId, userId), eq(passkey.audience, audience)));
  const [totp] = await database
    .select({ id: twoFactor.id })
    .from(twoFactor)
    .where(and(eq(twoFactor.userId, userId), eq(twoFactor.verified, true)))
    .limit(1);
  return (keys?.count ?? 0) > 0 || totp !== undefined;
}

export async function getSessionSecurity(
  database: Database,
  sessionId: string,
  audience: Audience,
) {
  const [record] = await database
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
    .limit(1);
  return record ?? null;
}

export async function markSessionStrong(
  database: Database,
  sessionId: string,
  audience: Audience,
  method: "password_totp" | "passkey_uv",
) {
  const [updated] = await database
    .update(session)
    .set({
      authenticationMethod: method,
      authenticatedAt: new Date(),
    })
    .where(and(eq(session.id, sessionId), eq(session.audience, audience)))
    .returning({ id: session.id });
  if (!updated) throw new Error("SESSION_REVOKED");
}

export async function revokeUserSessions(database: Database, userId: string) {
  await database.delete(oauthAccessToken).where(eq(oauthAccessToken.userId, userId));
  await database.delete(oauthRefreshToken).where(eq(oauthRefreshToken.userId, userId));
  await database.delete(session).where(eq(session.userId, userId));
}

export async function findWikiReader(database: Database, userId: string) {
  const [record] = await database
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.id, userId), eq(user.role, "admin"), eq(user.emailVerified, true)))
    .limit(1);
  return record ?? null;
}
