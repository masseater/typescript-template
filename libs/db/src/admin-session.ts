import { APPLICATION, ROLE, strongAuthenticationMethods } from "@repo/config";
import { and, eq, exists, gt, inArray, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { Effect } from "effect";

import { ADMIN_PERMISSION } from "./identity-schema.ts";
import { AdminStrongSessionRequired } from "./admin-strong-session-required.ts";
import { OperatingAdminRequired } from "./operating-admin-required.ts";
import { session, user } from "./schema.ts";
import { getSessionSecurity } from "./security.ts";

import type { DrizzleDatabase } from "./database.ts";

const requireAdmin = Effect.fn("requireAdmin")(function* requireAdmin(sessionId: string) {
  const actor = yield* getSessionSecurity(sessionId, APPLICATION.admin);
  if (
    actor?.user.role !== ROLE.administrator ||
    !actor.user.emailVerified ||
    !strongAuthenticationMethods.some((method) => method === actor.session.authenticationMethod)
  ) {
    return yield* new AdminStrongSessionRequired();
  }
  return actor;
});

const requireOperatingAdmin = Effect.fn("requireOperatingAdmin")(function* requireOperatingAdmin(
  sessionId: string,
) {
  const actor = yield* requireAdmin(sessionId);
  if (
    actor.user.adminPermission !== ADMIN_PERMISSION.operate &&
    actor.user.adminPermission !== ADMIN_PERMISSION.grant
  ) {
    return yield* new OperatingAdminRequired();
  }
  return actor;
});

const liveAdmin = (database: DrizzleDatabase, sessionId: string): SQL => {
  const actor = alias(user, "actor");
  const checkedAt = new Date();
  const liveSession = and(
    eq(session.id, sessionId),
    eq(session.audience, APPLICATION.admin),
    eq(actor.role, ROLE.administrator),
    eq(actor.emailVerified, true),
    eq(session.securityVersion, actor.securityVersion),
    gt(session.expiresAt, checkedAt),
    inArray(session.authenticationMethod, strongAuthenticationMethods),
  );
  const sessions = database
    .select({ id: session.id })
    .from(session)
    .innerJoin(actor, eq(session.userId, actor.id))
    .where(liveSession);
  return exists(sessions);
};

export { liveAdmin, requireAdmin, requireOperatingAdmin };
