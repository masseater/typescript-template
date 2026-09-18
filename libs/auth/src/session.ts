import { Effect } from "effect";

import { getSessionSecurity } from "@template/db/security";

import { AdminMfaRequired } from "./admin-mfa-required.ts";
import { AdminRequired } from "./admin-required.ts";
import { authSession } from "./auth-request.ts";
import { Auth } from "./auth.ts";
import { isStrongMethod } from "./policy.ts";
import { SessionInvalid } from "./session-invalid.ts";
import { SessionRequired } from "./session-required.ts";

const requireSessionSecurity = Effect.fn("requireSessionSecurity")(function* requireSessionSecurity(
  headers: Headers,
) {
  const { audience } = yield* Auth;
  const session = yield* authSession(headers);
  if (!session) {
    return yield* new SessionRequired();
  }
  const current = yield* getSessionSecurity(session.session.id, audience);
  if (current?.user.emailVerified !== true) {
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
  if (audience !== "user") {
    yield* verifyAdmin(current.user.role, strong, allowEnrollment);
  }
  return { session: current.session, strong, user: current.user };
});

// oxlint-disable-next-line typescript/explicit-function-return-type, typescript/explicit-module-boundary-types
function verifySession(headers: Headers, allowEnrollment = false) {
  return verifySessionWith(headers, allowEnrollment);
}

export { verifySession };
