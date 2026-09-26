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
import { Effect } from "effect";

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
  audience: APPLICATION.serviceAdmin,
  levels: adminPermissions,
  role: ROLE.admin,
};

const staffPrivilege: Privilege = {
  audience: APPLICATION.internalDashboard,
  levels: staffPermissions,
  role: ROLE.staff,
};

const atLeast = (
  levels: readonly AccountPermission[],
  required: AccountPermission,
): readonly AccountPermission[] => levels.slice(levels.indexOf(required));

const requireActor = Effect.fn("requireActor")(function* requireActor(
  privilege: Privilege,
  demand: Readonly<{ required: AccountPermission; sessionId: string }>,
) {
  const { required, sessionId } = demand;
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

const requireAdmin = (
  sessionId: string,
  required: AdminPermission = ADMIN_PERMISSION.viewer,
): ReturnType<typeof requireActor> => requireActor(adminPrivilege, { required, sessionId });

const requireStaff = (
  sessionId: string,
  required: StaffPermission = STAFF_PERMISSION.viewer,
): ReturnType<typeof requireActor> => requireActor(staffPrivilege, { required, sessionId });

type LiveCheck<Permission extends AccountPermission> = Readonly<{
  checkedAt: Date;
  required?: Permission;
  sessionId: string;
}>;

const liveActor = (
  database: DrizzleDatabase,
  check: Readonly<{
    checkedAt: Date;
    privilege: Privilege;
    required: AccountPermission;
    sessionId: string;
  }>,
): SQL => {
  const { checkedAt, privilege, required, sessionId } = check;
  const actor = alias(user, "actor");
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

const liveAdmin = (database: DrizzleDatabase, check: LiveCheck<AdminPermission>): SQL =>
  liveActor(database, {
    checkedAt: check.checkedAt,
    privilege: adminPrivilege,
    required: check.required ?? ADMIN_PERMISSION.viewer,
    sessionId: check.sessionId,
  });

const liveStaff = (database: DrizzleDatabase, check: LiveCheck<StaffPermission>): SQL =>
  liveActor(database, {
    checkedAt: check.checkedAt,
    privilege: staffPrivilege,
    required: check.required ?? STAFF_PERMISSION.viewer,
    sessionId: check.sessionId,
  });

export { liveAdmin, liveStaff, requireAdmin, requireStaff };
export type { LiveCheck };
