import { ACCOUNT_STATE, APPLICATION, ROLE } from "@repo/config";
import { lookupSessionByToken } from "@repo/db/security";
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
  const current = yield* lookupSessionByToken(token);
  if (current === null || current.session.expiresAt <= new Date()) {
    return yield* new SessionRequired();
  }
  if (!sessionIsLive(current, audience)) {
    return yield* new SessionInvalid();
  }
  return current;
});

const verifySessionWith = Effect.fn("verifySession")(function* verifySessionProgram(
  headers: Headers,
  allowEnrollment: boolean,
) {
  const { audience } = yield* Auth;
  const current = yield* requireSessionSecurity(headers);
  if (current.user.accountState !== ACCOUNT_STATE.active) {
    return yield* new SessionInvalid();
  }
  const strong = isStrongMethod(current.session.authenticationMethod);
  const { role } = current.user;
  if (audience === APPLICATION.admin && role !== ROLE.administrator) {
    return yield* new AdminRequired();
  }
  if (audience === APPLICATION.wiki && role !== ROLE.staff) {
    return yield* new AdminRequired();
  }
  if (audience !== APPLICATION.user && !allowEnrollment && !strong) {
    return yield* new AdminMfaRequired();
  }
  const { accountState, email, id, name, permission, twoFactorEnabled } = current.user;
  return {
    session: { id: current.session.id },
    strong,
    user: { accountState, email, id, name, permission, role, twoFactorEnabled },
  };
});

const verifySession = function verifySession(
  headers: Headers,
  allowEnrollment = false,
): ReturnType<typeof verifySessionWith> {
  return verifySessionWith(headers, allowEnrollment);
};

export { verifySession };
