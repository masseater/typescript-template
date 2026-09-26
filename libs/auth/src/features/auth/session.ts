import { audienceRoles, type Application } from "@repo/config";
import { lookupSessionByToken } from "@repo/db";
import { DateTime, Effect } from "effect";

import { AdminMfaRequired } from "./admin-mfa-required.ts";
import { AdminRequired } from "./admin-required.ts";
import { Auth } from "./auth.ts";
import { isPrivilegedRole, isStrongMethod, sessionIsLive } from "./policy.ts";
import { SessionInvalid } from "./session-invalid.ts";
import { SessionRequired } from "./session-required.ts";
import { sessionTokenFrom } from "./session-token.ts";

const readLiveSession = Effect.fn("readLiveSession")(function* readLiveSession(headers: Headers) {
  const { audience, instance } = yield* Auth;
  const cookiePrefix = instance.options.advanced?.cookiePrefix;
  const secret = instance.options.secret;
  if (typeof cookiePrefix !== "string" || typeof secret !== "string") {
    return yield* SessionRequired.make();
  }
  const token = yield* sessionTokenFrom({ cookiePrefix, headers, secret });
  if (token === undefined) {
    return yield* SessionRequired.make();
  }
  const sessionRecord = yield* lookupSessionByToken(token);
  if (
    sessionRecord === undefined ||
    sessionRecord.session.expiresAt.getTime() <= DateTime.toEpochMillis(yield* DateTime.now)
  ) {
    return yield* SessionRequired.make();
  }
  if (!sessionIsLive(sessionRecord, audience)) {
    return yield* SessionInvalid.make();
  }
  return sessionRecord;
});

const verifyPrivileged = Effect.fn("verifyPrivileged")(function* verifyPrivileged({
  allowEnrollment,
  audience,
  role,
  strong,
}: {
  readonly allowEnrollment: boolean;
  readonly audience: Application;
  readonly role: string;
  readonly strong: boolean;
}) {
  if (role !== audienceRoles[audience]) {
    return yield* AdminRequired.make();
  }
  if (!allowEnrollment && !strong) {
    return yield* AdminMfaRequired.make();
  }
});

const verifySessionWith = Effect.fn("verifySession")(function* verifySessionProgram(
  headers: Headers,
  allowEnrollment: boolean,
) {
  const { audience } = yield* Auth;
  const sessionRecord = yield* readLiveSession(headers);
  const strong = isStrongMethod(sessionRecord.session.authenticationMethod);
  if (isPrivilegedRole(audienceRoles[audience])) {
    yield* verifyPrivileged({
      allowEnrollment,
      audience,
      role: sessionRecord.user.role,
      strong,
    });
  }
  const { email, id, name, permission, role, twoFactorEnabled } = sessionRecord.user;
  return {
    session: { id: sessionRecord.session.id },
    strong,
    user: { email, id, name, permission, role, twoFactorEnabled },
  };
});

const verifySession = (
  headers: Headers,
  allowEnrollment = false,
): ReturnType<typeof verifySessionWith> => verifySessionWith(headers, allowEnrollment);

const verifiedSessionId = Effect.fn("verifiedSessionId")(function* verifiedSessionId(
  incoming: Readonly<{ headers: Headers }>,
) {
  const { session } = yield* verifySession(incoming.headers);
  return session.id;
});

export { verifiedSessionId, verifySession };
