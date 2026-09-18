import { and, eq, exists, gt, inArray } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { Effect } from "effect";

import { strongAuthenticationMethods } from "@repo/config";

import { AdminStrongSessionRequired } from "./admin-strong-session-required.ts";
import type { DrizzleDatabase } from "./database.ts";
import { session, user } from "./schema.ts";
import { getSessionSecurity } from "./security.ts";

const requireAdmin = Effect.fn("requireAdmin")(function* requireAdmin(sessionId: string) {
  const actor = yield* getSessionSecurity(sessionId, "admin");
  if (
    actor?.user.role !== "admin" ||
    !actor.user.emailVerified ||
    !strongAuthenticationMethods.some((method) => method === actor.session.authenticationMethod)
  ) {
    return yield* new AdminStrongSessionRequired();
  }
  return actor;
});

function liveAdmin(database: DrizzleDatabase, sessionId: string): SQL {
  const actor = alias(user, "actor");
  const now = new Date();
  const liveSession = and(
    eq(session.id, sessionId),
    eq(session.audience, "admin"),
    eq(actor.role, "admin"),
    eq(actor.emailVerified, true),
    eq(session.securityVersion, actor.securityVersion),
    gt(session.expiresAt, now),
    inArray(session.authenticationMethod, strongAuthenticationMethods),
  );
  const sessions = database
    .select({ id: session.id })
    .from(session)
    .innerJoin(actor, eq(session.userId, actor.id))
    .where(liveSession);
  return exists(sessions);
}

export { liveAdmin, requireAdmin };
