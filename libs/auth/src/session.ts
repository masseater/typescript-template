import { APPLICATION, ROLE } from "@repo/config";
import { getSessionSecurity } from "@repo/db/security";
import { Effect } from "effect";

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
  const authenticated = yield* authSession(headers);
  if (!authenticated) {
    return yield* new SessionRequired();
  }
  const liveSession = yield* getSessionSecurity(authenticated.session.id, audience);
  if (liveSession?.user.emailVerified !== true) {
    return yield* new SessionInvalid();
  }
  return liveSession;
});

const verifyAdmin = Effect.fn("verifyAdmin")(function* verifyAdmin(checked: {
  readonly role: string;
  readonly strong: boolean;
  readonly allowEnrollment: boolean;
}) {
  if (checked.role !== ROLE.administrator) {
    return yield* new AdminRequired();
  }
  if (!checked.allowEnrollment && !checked.strong) {
    return yield* new AdminMfaRequired();
  }
});

export const verifySession = Effect.fn("verifySession")(function* verifySessionProgram(
  headers: Headers,
  allowEnrollment?: boolean,
) {
  const { audience } = yield* Auth;
  const liveSession = yield* requireSessionSecurity(headers);
  const strong = isStrongMethod(liveSession.session.authenticationMethod);
  if (audience !== APPLICATION.user) {
    yield* verifyAdmin({
      allowEnrollment: allowEnrollment === true,
      role: liveSession.user.role,
      strong,
    });
  }
  const { email, id, name, role, twoFactorEnabled } = liveSession.user;
  return {
    session: { id: liveSession.session.id },
    strong,
    user: { email, id, name, role, twoFactorEnabled },
  };
});
