import { APPLICATION } from "@repo/config";
import {
  ACCOUNT_STATE,
  ADMIN_PERMISSION,
  ROLE,
  accountStates,
  adminPermissions,
  type AccountState,
  type AdminPermission,
} from "@repo/config/identity";
import { maximumAdminPageSize } from "@repo/config/paging";
import { and, count, desc, eq, or, type SQL } from "drizzle-orm";
import { Effect, Schema } from "effect";

import { auditWhenTargeted, type AuditEntry } from "./audit.ts";
import { containsKeyword } from "./contains-keyword.ts";
import { query } from "./database.ts";
import { issueInvite } from "./invite.ts";
import { LastAdminRequired } from "./last-admin-required.ts";
import { liveAdmin, requireAdmin } from "./privileged-session.ts";
import { AUDIT_ACTION, user } from "./schema.ts";
import { TargetUnavailable } from "./target-unavailable.ts";

import type { DatabaseFailure } from "./database-failure.ts";

export const UserPage = Schema.Struct({
  accountState: Schema.optionalKey(Schema.Literals(accountStates)),
  emailVerified: Schema.optionalKey(Schema.Boolean),
  keyword: Schema.optionalKey(Schema.String),
  limit: Schema.Int.check(Schema.isBetween({ maximum: maximumAdminPageSize, minimum: 1 })),
  offset: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

const mentionsLastAdmin = (cause: unknown): boolean =>
  cause instanceof Error &&
  (cause.message.includes("LAST_ADMIN_REQUIRED") || mentionsLastAdmin(cause.cause));

const protectLastAdmin = <Value, Requirements>(
  effect: Effect.Effect<Value, DatabaseFailure, Requirements>,
): Effect.Effect<Value, DatabaseFailure | LastAdminRequired, Requirements> => {
  return effect.pipe(
    Effect.mapError((failure) =>
      mentionsLastAdmin(failure.cause) ? new LastAdminRequired() : failure,
    ),
  );
};

const matchesPage = (page: typeof UserPage.Type): SQL | undefined => {
  const { accountState, emailVerified, keyword } = page;
  return and(
    eq(user.role, ROLE.member),
    keyword === undefined
      ? undefined
      : or(containsKeyword(user.name, keyword), containsKeyword(user.email, keyword)),
    accountState === undefined ? undefined : eq(user.accountState, accountState),
    emailVerified === undefined ? undefined : eq(user.emailVerified, emailVerified),
  );
};

const memberColumns = {
  accountState: user.accountState,
  createdAt: user.createdAt,
  email: user.email,
  emailVerified: user.emailVerified,
  id: user.id,
  name: user.name,
  twoFactorEnabled: user.twoFactorEnabled,
};

export const listUsers = Effect.fn("listUsers")(function* listUsers(
  sessionId: string,
  page: typeof UserPage.Type,
) {
  yield* requireAdmin(sessionId);

  const users = yield* query((database) =>
    database
      .select(memberColumns)
      .from(user)
      .where(and(liveAdmin(database, sessionId), matchesPage(page)))
      .orderBy(desc(user.createdAt), user.id)
      .limit(page.limit)
      .offset(page.offset),
  );

  const [matching] = yield* query((database) =>
    database
      .select({ count: count() })
      .from(user)
      .where(and(liveAdmin(database, sessionId), matchesPage(page))),
  );
  return { total: matching?.count ?? 0, users };
});

const adminActor = (
  actor: Readonly<{ user: Readonly<{ id: string }> }>,
  action: AuditEntry["action"],
): Omit<AuditEntry, "targetId"> => ({
  action,
  actorId: actor.user.id,
  actorKind: ROLE.administrator,
});

const adminEntry = (
  actor: Readonly<{ user: Readonly<{ id: string }> }>,
  action: AuditEntry["action"],
  targetId: string,
): AuditEntry => ({ ...adminActor(actor, action), targetId });

export const setMemberState = Effect.fn("setMemberState")(function* setMemberState(change: {
  readonly sessionId: string;
  readonly memberId: string;
  readonly accountState: AccountState;
}) {
  const { accountState, memberId, sessionId } = change;
  const actor = yield* requireAdmin(sessionId, ADMIN_PERMISSION.operator);
  const action =
    accountState === ACCOUNT_STATE.suspended
      ? AUDIT_ACTION.memberSuspended
      : AUDIT_ACTION.memberUnsuspended;
  const [, changedMembers] = yield* query(async (database) => {
    const live = liveAdmin(database, sessionId, ADMIN_PERMISSION.operator);
    const audit = database.run(
      auditWhenTargeted(database, adminEntry(actor, action, memberId), live),
    );
    const transition = database
      .update(user)
      .set({ accountState, updatedAt: new Date() })
      .where(and(eq(user.id, memberId), eq(user.role, ROLE.member), live))
      .returning({ accountState: user.accountState, id: user.id });
    return database.batch([audit, transition] as const);
  });
  const [changed] = changedMembers;
  if (!changed) {
    return yield* new TargetUnavailable();
  }
  return changed;
});

export const deleteUser = Effect.fn("deleteUser")(function* deleteUser(
  sessionId: string,
  targetId: string,
) {
  const actor = yield* requireAdmin(sessionId, ADMIN_PERMISSION.operator);
  const [, removedUsers] = yield* query(async (database) => {
    const live = liveAdmin(database, sessionId, ADMIN_PERMISSION.operator);
    const audit = database.run(
      auditWhenTargeted(database, adminEntry(actor, AUDIT_ACTION.userDeleted, targetId), live),
    );
    const removal = database
      .delete(user)
      .where(and(eq(user.id, targetId), eq(user.role, ROLE.member), live))
      .returning({ id: user.id });
    return database.batch([audit, removal] as const);
  });
  const [removed] = removedUsers;
  if (!removed) {
    return yield* new TargetUnavailable();
  }
  return removed;
});

const adminPermissionOf = (permission: string | null): AdminPermission | undefined =>
  adminPermissions.find((level) => level === permission);

export const listAdmins = Effect.fn("listAdmins")(function* listAdmins(sessionId: string) {
  yield* requireAdmin(sessionId, ADMIN_PERMISSION.owner);
  const admins = yield* query((database) =>
    database
      .select({
        accountState: user.accountState,
        createdAt: user.createdAt,
        email: user.email,
        id: user.id,
        name: user.name,
        permission: user.permission,
      })
      .from(user)
      .where(
        and(
          eq(user.role, ROLE.administrator),
          liveAdmin(database, sessionId, ADMIN_PERMISSION.owner),
        ),
      )
      .orderBy(desc(user.createdAt), user.id),
  );
  return admins.map((admin) => ({ ...admin, permission: adminPermissionOf(admin.permission) }));
});

export const inviteAdmin = Effect.fn("inviteAdmin")(function* inviteAdmin(draft: {
  readonly email: string;
  readonly permission: AdminPermission;
  readonly sessionId: string;
}) {
  const actor = yield* requireAdmin(draft.sessionId, ADMIN_PERMISSION.owner);
  return yield* issueInvite({
    audience: APPLICATION.admin,
    audit: adminActor(actor, AUDIT_ACTION.adminInvited),
    email: draft.email,
    permission: draft.permission,
  });
});

export const setAdminPermission = Effect.fn("setAdminPermission")(
  function* setAdminPermission(change: {
    readonly adminId: string;
    readonly permission: AdminPermission;
    readonly sessionId: string;
  }) {
    const { adminId, permission, sessionId } = change;
    const actor = yield* requireAdmin(sessionId, ADMIN_PERMISSION.owner);
    const [, changedAdmins] = yield* query(async (database) => {
      const live = liveAdmin(database, sessionId, ADMIN_PERMISSION.owner);
      const audit = database.run(
        auditWhenTargeted(
          database,
          adminEntry(actor, AUDIT_ACTION.adminPermissionChanged, adminId),
          live,
        ),
      );
      const transition = database
        .update(user)
        .set({ permission, updatedAt: new Date() })
        .where(and(eq(user.id, adminId), eq(user.role, ROLE.administrator), live))
        .returning({ id: user.id, permission: user.permission });
      return database.batch([audit, transition] as const);
    }).pipe(protectLastAdmin);
    const [changed] = changedAdmins;
    if (!changed) {
      return yield* new TargetUnavailable();
    }
    return { id: changed.id, permission: adminPermissionOf(changed.permission) };
  },
);

export const setAdminState = Effect.fn("setAdminState")(function* setAdminState(change: {
  readonly adminId: string;
  readonly accountState: AccountState;
  readonly sessionId: string;
}) {
  const { accountState, adminId, sessionId } = change;
  const actor = yield* requireAdmin(sessionId, ADMIN_PERMISSION.owner);
  if (actor.user.id === adminId) {
    return yield* new TargetUnavailable();
  }
  const action =
    accountState === ACCOUNT_STATE.suspended
      ? AUDIT_ACTION.adminDisabled
      : AUDIT_ACTION.adminEnabled;
  const [, changedAdmins] = yield* query(async (database) => {
    const live = liveAdmin(database, sessionId, ADMIN_PERMISSION.owner);
    const audit = database.run(
      auditWhenTargeted(database, adminEntry(actor, action, adminId), live),
    );
    const transition = database
      .update(user)
      .set({ accountState, updatedAt: new Date() })
      .where(and(eq(user.id, adminId), eq(user.role, ROLE.administrator), live))
      .returning({ accountState: user.accountState, id: user.id });
    return database.batch([audit, transition] as const);
  }).pipe(protectLastAdmin);
  const [changed] = changedAdmins;
  if (!changed) {
    return yield* new TargetUnavailable();
  }
  return changed;
});

export { AdminStrongSessionRequired } from "./admin-strong-session-required.ts";
export { InviteRejected } from "./invite-rejected.ts";
export { LastAdminRequired } from "./last-admin-required.ts";
export { PermissionRequired } from "./permission-required.ts";
export { TargetUnavailable } from "./target-unavailable.ts";
