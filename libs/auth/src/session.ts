import { APPLICATION, ROLE } from "@repo/config";
import { lookupSessionByToken } from "@repo/db";
import { Effect } from "effect";

import { AdminMfaRequired } from "./admin-mfa-required.ts";
import { AdminRequired } from "./admin-required.ts";
import { Auth } from "./auth.ts";
import { isStrongMethod, sessionIsLive } from "./policy.ts";
import { SessionInvalid } from "./session-invalid.ts";
import { SessionRequired } from "./session-required.ts";
import { sessionTokenFrom } from "./session-token.ts";

const requireSessionSecurity = Effect.fn("requireSessionSecurity")(function* requireSessionSecurity(
  headers: Headers,
) {
  const { audience, instance } = yield* Auth;
  const cookiePrefix = instance.options.advanced?.cookiePrefix;
  const secret = instance.options.secret;
  if (typeof cookiePrefix !== "string" || typeof secret !== "string") {
    return yield* new SessionRequired();
  }
  const token = yield* Effect.promise(async () => sessionTokenFrom(headers, cookiePrefix, secret));
  if (token === undefined) {
    return yield* new SessionRequired();
  }
  const sessionRecord = yield* lookupSessionByToken(token);
  if (sessionRecord === undefined || sessionRecord.session.expiresAt <= new Date()) {
    return yield* new SessionRequired();
  }
  if (!sessionIsLive(sessionRecord, audience)) {
    return yield* new SessionInvalid();
  }
  return sessionRecord;
});

const verifyAdmin = Effect.fn("verifyAdmin")(function* verifyAdmin(
  role: string,
  strong: boolean,
  allowEnrollment: boolean,
) {
  if (role !== ROLE.administrator) {
    return yield* new AdminRequired();
  }
  if (!allowEnrollment && !strong) {
    return yield* new AdminMfaRequired();
  }
});

const verifySessionWith = Effect.fn("verifySession")(function* verifySessionProgram(
  headers: Headers,
  allowEnrollment: boolean,
) {
  const { audience } = yield* Auth;
  const sessionRecord = yield* requireSessionSecurity(headers);
  const strong = isStrongMethod(sessionRecord.session.authenticationMethod);
  if (audience !== APPLICATION.user) {
    yield* verifyAdmin(sessionRecord.user.role, strong, allowEnrollment);
  }
  const { email, id, name, role, twoFactorEnabled } = sessionRecord.user;
  return {
    session: { id: sessionRecord.session.id },
    strong,
    user: { email, id, name, role, twoFactorEnabled },
  };
});

const verifySession = function verifySession(
  headers: Headers,
  allowEnrollment = false,
): ReturnType<typeof verifySessionWith> {
  return verifySessionWith(headers, allowEnrollment);
};

export { verifySession };
