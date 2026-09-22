import { APPLICATION, ROLE } from "@repo/config";
import { lookupSessionByToken } from "@repo/db";
import { DateTime, Effect } from "effect";

import { AdminMfaRequired } from "./admin-mfa-required.ts";
import { AdminRequired } from "./admin-required.ts";
import { Auth } from "./auth.ts";
import { isStrongMethod, sessionIsLive } from "./policy.ts";
import { SessionInvalid } from "./session-invalid.ts";
import { SessionRequired } from "./session-required.ts";
import { sessionTokenFrom } from "./session-token.ts";

const readLiveSession = Effect.fn("readLiveSession")(function* readLiveSession(headers: Headers) {
  const { audience, instance } = yield* Auth;
  const cookiePrefix = instance.options.advanced?.cookiePrefix;
  const secret = instance.options.secret;
  if (typeof cookiePrefix !== "string" || typeof secret !== "string") {
    return yield* new SessionRequired();
  }
  const token = yield* sessionTokenFrom({ cookiePrefix, headers, secret });
  if (token === undefined) {
    return yield* new SessionRequired();
  }
  const sessionRecord = yield* lookupSessionByToken(token);
  if (
    sessionRecord === undefined ||
    sessionRecord.session.expiresAt.getTime() <= DateTime.toEpochMillis(yield* DateTime.now)
  ) {
    return yield* new SessionRequired();
  }
  if (!sessionIsLive(sessionRecord, audience)) {
    return yield* new SessionInvalid();
  }
  return sessionRecord;
});

const verifyAdmin = Effect.fn("verifyAdmin")(function* verifyAdmin({
  allowEnrollment,
  role,
  strong,
}: {
  readonly allowEnrollment: boolean;
  readonly role: string;
  readonly strong: boolean;
}) {
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
  const sessionRecord = yield* readLiveSession(headers);
  const strong = isStrongMethod(sessionRecord.session.authenticationMethod);
  if (audience !== APPLICATION.user) {
    yield* verifyAdmin({
      allowEnrollment,
      role: sessionRecord.user.role,
      strong,
    });
  }
  const { email, id, name, role, twoFactorEnabled } = sessionRecord.user;
  return {
    session: { id: sessionRecord.session.id },
    strong,
    user: { email, id, name, role, twoFactorEnabled },
  };
});

const verifySession = (
  headers: Headers,
  allowEnrollment = false,
): ReturnType<typeof verifySessionWith> => verifySessionWith(headers, allowEnrollment);

export { verifySession };
