import type { Audience, Database } from "./index.ts";
import { and, count, eq, gt } from "drizzle-orm";
import { passkey, session, twoFactor, user, verification } from "./schema.ts";

type User = typeof user.$inferSelect;
interface SessionSecurity {
  session: typeof session.$inferSelect;
  user: User;
}
type StrongAuthenticationMethod = "password_totp" | "passkey_uv";

async function hasVerificationAudience(
  database: Readonly<Pick<Database, "select">>,
  identifier: string,
  audience: Audience,
): Promise<boolean> {
  const unexpired = gt(verification.expiresAt, new Date());
  const [record] = await database
    .select({ id: verification.id })
    .from(verification)
    .where(
      and(eq(verification.identifier, identifier), eq(verification.audience, audience), unexpired),
    )
    .limit(1);
  return record !== undefined;
}

async function findUser(
  database: Readonly<Pick<Database, "select">>,
  userId: string,
): Promise<User | undefined> {
  const [record] = await database.select().from(user).where(eq(user.id, userId)).limit(1);
  return record;
}

async function findPasskeyUser(
  database: Readonly<Pick<Database, "select">>,
  credentialId: string,
  audience: Audience,
): Promise<User | undefined> {
  const [record] = await database
    .select({ user })
    .from(passkey)
    .innerJoin(user, eq(passkey.userId, user.id))
    .where(and(eq(passkey.credentialID, credentialId), eq(passkey.audience, audience)))
    .limit(1);
  return record?.user;
}

async function hasEnrolledFactor(
  database: Readonly<Pick<Database, "select">>,
  userId: string,
  audience: Audience,
): Promise<boolean> {
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

async function getSessionSecurity(
  database: Readonly<Pick<Database, "select">>,
  sessionId: string,
  audience: Audience,
): Promise<SessionSecurity | undefined> {
  const unexpired = gt(session.expiresAt, new Date());
  const [record] = await database
    .select({ session, user })
    .from(session)
    .innerJoin(user, eq(session.userId, user.id))
    .where(
      and(
        eq(session.id, sessionId),
        eq(session.audience, audience),
        eq(session.securityVersion, user.securityVersion),
        unexpired,
      ),
    )
    .limit(1);
  return record;
}

async function markSessionStrong({
  audience,
  database,
  method,
  sessionId,
}: Readonly<{
  audience: Audience;
  database: Readonly<Pick<Database, "update">>;
  method: StrongAuthenticationMethod;
  sessionId: string;
}>): Promise<void> {
  const [updated] = await database
    .update(session)
    .set({
      authenticatedAt: new Date(),
      authenticationMethod: method,
    })
    .where(and(eq(session.id, sessionId), eq(session.audience, audience)))
    .returning({ id: session.id });
  if (!updated) {
    throw new Error("SESSION_REVOKED");
  }
}

async function revokeUserSessions(
  database: Readonly<Pick<Database, "delete">>,
  userId: string,
): Promise<void> {
  await database.delete(session).where(eq(session.userId, userId));
}

export {
  findPasskeyUser,
  findUser,
  getSessionSecurity,
  hasEnrolledFactor,
  hasVerificationAudience,
  markSessionStrong,
  revokeUserSessions,
};
export type { SessionSecurity };
