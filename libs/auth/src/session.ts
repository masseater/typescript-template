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

const verifyAdmin = Effect.fn("verifyAdmin")(function* verifyAdmin(
  role: string,
  strong: boolean,
  allowEnrollment: boolean,
) {
  if (role !== "admin") {
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
  if (audience !== "service-member") {
    yield* verifyAdmin(current.user.role, strong, allowEnrollment);
  }
  return { session: current.session, strong, user: current.user };
});

// oxlint-disable-next-line typescript/explicit-function-return-type, typescript/explicit-module-boundary-types
function verifySession(headers: Headers, allowEnrollment = false) {
  return verifySessionWith(headers, allowEnrollment);
}

export { verifySession };
