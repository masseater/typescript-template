import { audienceRoles, type Application } from "@repo/config";
import { lookupSessionByToken } from "@repo/db";
import { Effect } from "effect";

import { AdminMfaRequired } from "./admin-mfa-required.ts";
import { AdminRequired } from "./admin-required.ts";
import { Auth } from "./auth.ts";
import { isPrivilegedRole, isStrongMethod, sessionIsLive } from "./policy.ts";
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
  const current = yield* lookupSessionByToken(token);
  if (current === undefined || current.session.expiresAt <= new Date()) {
    return yield* new SessionRequired();
  }
  if (!sessionIsLive(current, audience)) {
    return yield* new SessionInvalid();
  }
  return current;
});

const verifyPrivileged = Effect.fn("verifyPrivileged")(function* verifyPrivileged(
  role: string,
  audience: Application,
  strong: boolean,
  allowEnrollment: boolean,
) {
  if (role !== audienceRoles[audience]) {
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
  const current = yield* requireSessionSecurity(headers);
  const strong = isStrongMethod(current.session.authenticationMethod);
  if (isPrivilegedRole(audienceRoles[audience])) {
    yield* verifyPrivileged(current.user.role, audience, strong, allowEnrollment);
  }
  const { email, id, name, permission, role, twoFactorEnabled } = current.user;
  return {
    session: { id: current.session.id },
    strong,
    user: { email, id, name, permission, role, twoFactorEnabled },
  };
});

const verifySession = function verifySession(
  headers: Headers,
  allowEnrollment = false,
): ReturnType<typeof verifySessionWith> {
  return verifySessionWith(headers, allowEnrollment);
};

export { verifySession };
