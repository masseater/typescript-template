import {
  ACCOUNT_STATE,
  ADMIN_PERMISSION,
  APPLICATION,
  ROLE,
  STAFF_PERMISSION,
  adminPermissions,
  staffPermissions,
  strongAuthenticationMethods,
  type AccountPermission,
  type AdminPermission,
  type Application,
  type Role,
  type StaffPermission,
} from "@repo/config";
import { and, eq, exists, gt, inArray, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { DateTime, Effect } from "effect";

import { AdminStrongSessionRequired } from "./admin-strong-session-required.ts";
import { PermissionRequired } from "./permission-required.ts";
import { session, user } from "./schema.ts";
import { getSessionSecurity } from "./security.ts";

import type { DrizzleDatabase } from "./database.ts";

type Privilege = Readonly<{
  audience: Application;
  levels: readonly AccountPermission[];
  role: Role;
}>;

const adminPrivilege: Privilege = {
  audience: APPLICATION.admin,
  levels: adminPermissions,
  role: ROLE.administrator,
};

const staffPrivilege: Privilege = {
  audience: APPLICATION.wiki,
  levels: staffPermissions,
  role: ROLE.staff,
};

const atLeast = (
  levels: readonly AccountPermission[],
  required: AccountPermission,
): readonly AccountPermission[] => levels.slice(levels.indexOf(required));

const requireActor = Effect.fn("requireActor")(function* requireActor(
  privilege: Privilege,
  sessionId: string,
  required: AccountPermission,
) {
  const actor = yield* getSessionSecurity(sessionId, privilege.audience);
  if (
    actor?.user.role !== privilege.role ||
    actor.user.accountState !== ACCOUNT_STATE.active ||
    !actor.user.emailVerified ||
    !strongAuthenticationMethods.some((method) => method === actor.session.authenticationMethod)
  ) {
    return yield* new AdminStrongSessionRequired();
  }
  const { permission } = actor.user;
  if (permission === null || !atLeast(privilege.levels, required).includes(permission)) {
    return yield* new PermissionRequired({ required });
  }
  return { ...actor, permission };
});

const liveActor = (
  database: DrizzleDatabase,
  privilege: Privilege,
  sessionId: string,
  required: AccountPermission,
): SQL => {
  const actor = alias(user, "actor");
  const checkedAt = DateTime.toDate(DateTime.nowUnsafe());
  const liveSession = and(
    eq(session.id, sessionId),
    eq(session.audience, privilege.audience),
    eq(actor.role, privilege.role),
    eq(actor.accountState, ACCOUNT_STATE.active),
    eq(actor.emailVerified, true),
    inArray(actor.permission, atLeast(privilege.levels, required)),
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

const requireAdmin = (
  sessionId: string,
  required: AdminPermission = ADMIN_PERMISSION.viewer,
): ReturnType<typeof requireActor> => requireActor(adminPrivilege, sessionId, required);

const liveAdmin = (
  database: DrizzleDatabase,
  sessionId: string,
  required: AdminPermission = ADMIN_PERMISSION.viewer,
): SQL => liveActor(database, adminPrivilege, sessionId, required);

const requireStaff = (
  sessionId: string,
  required: StaffPermission = STAFF_PERMISSION.viewer,
): ReturnType<typeof requireActor> => requireActor(staffPrivilege, sessionId, required);

const liveStaff = (
  database: DrizzleDatabase,
  sessionId: string,
  required: StaffPermission = STAFF_PERMISSION.viewer,
): SQL => liveActor(database, staffPrivilege, sessionId, required);

export { liveAdmin, liveStaff, requireAdmin, requireStaff };
