import {
  ACCOUNT_STATE,
  ADMIN_PERMISSION,
  APPLICATION,
  ROLE,
  type AccountState,
  type AdminPermission,
} from "@repo/config";
import { and, count, desc, eq, or, sql, type SQL } from "drizzle-orm";
import { Effect, Schema } from "effect";

import { liveAdmin, requireAdmin } from "./admin-session.ts";
import { containsKeyword } from "./contains-keyword.ts";
import { query, type DrizzleDatabase } from "./database.ts";
import { issueInvite } from "./invite.ts";
import { LastAdminRequired } from "./last-admin-required.ts";
import { OperationForbidden } from "./operation-forbidden.ts";
import { AUDIT_ACTION, auditEvent, session, user, type AuditAction } from "./schema.ts";
import { TargetUnavailable } from "./target-unavailable.ts";

import type { DatabaseFailure } from "./database-failure.ts";

const MAX_PAGE_SIZE = 100;

export const UserPage = Schema.Struct({
  accountState: Schema.optionalKey(Schema.Literals([ACCOUNT_STATE.active, ACCOUNT_STATE.suspended, ACCOUNT_STATE.left])),
  emailVerified: Schema.optionalKey(Schema.Boolean),
  keyword: Schema.optionalKey(Schema.String),
  limit: Schema.Int.check(Schema.isBetween({ maximum: MAX_PAGE_SIZE, minimum: 1 })),
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

export const listUsers = Effect.fn("listUsers")(function* listUsers(
  sessionId: string,
  page: typeof UserPage.Type,
) {
  yield* requireAdmin(sessionId);

  const users = yield* query((database) =>
    database
      .select({
        accountState: user.accountState,
        createdAt: user.createdAt,
        email: user.email,
        emailVerified: user.emailVerified,
        id: user.id,
        name: user.name,
        twoFactorEnabled: user.twoFactorEnabled,
      })
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

const auditWhenTargeted = (
  database: DrizzleDatabase,
  {
    action,
    actorId,
    sessionId,
    targetId,
  }: Readonly<{
    action: AuditAction;
    actorId: string;
    sessionId: string;
    targetId: string;
  }>,
): SQL => {
  const auditColumns = [
    [auditEvent.action, action],
    [auditEvent.actorId, actorId],
    [auditEvent.createdAt, Date.now()],
    [auditEvent.id, crypto.randomUUID()],
    [auditEvent.targetId, targetId],
  ] as const;
  const columnNames = sql.join(
    auditColumns.map(([column]) => sql.identifier(column.name)),
    sql`, `,
  );
  const columnValues = sql.join(
    auditColumns.map(([, columnValue]) => sql`${columnValue}`),
    sql`, `,
  );
  const targeted = sql`SELECT 1 FROM ${user} WHERE ${user.id} = ${targetId} AND ${liveAdmin(database, sessionId)}`;
  return sql`INSERT INTO ${auditEvent} (${columnNames}) SELECT ${columnValues} WHERE EXISTS (${targeted})`;
};

const requirePermission = Effect.fn("requirePermission")(function* requirePermission(
  sessionId: string,
  accepted: readonly AdminPermission[],
) {
  const actor = yield* requireAdmin(sessionId);
  if (actor.user.permission === null || !accepted.includes(actor.user.permission)) {
    return yield* new OperationForbidden();
  }
  return actor;
});

const operatingPermissions = [ADMIN_PERMISSION.operate, ADMIN_PERMISSION.manage] as const;

export const setMemberAccountState = Effect.fn("setMemberAccountState")(
  function* setMemberAccountState(change: {
    readonly accountState: Extract<AccountState, "active" | "suspended">;
    readonly sessionId: string;
    readonly memberId: string;
  }) {
    const actor = yield* requirePermission(change.sessionId, operatingPermissions);
    const action =
      change.accountState === ACCOUNT_STATE.suspended
        ? AUDIT_ACTION.memberSuspended
        : AUDIT_ACTION.memberUnsuspended;
    const [, changedMembers] = yield* query(async (database) => {
      const audit = database.run(
        auditWhenTargeted(database, {
          action,
          actorId: actor.user.id,
          sessionId: change.sessionId,
          targetId: change.memberId,
        }),
      );
      const membership = database
        .update(user)
        .set({ accountState: change.accountState, updatedAt: new Date() })
        .where(
          and(
            eq(user.id, change.memberId),
            eq(user.role, ROLE.member),
            liveAdmin(database, change.sessionId),
          ),
        )
        .returning({ accountState: user.accountState, id: user.id });
      return database.batch([audit, membership] as const);
    });
    const [changed] = changedMembers;
    if (!changed) {
      return yield* new TargetUnavailable();
    }
    yield* query((database) => database.delete(session).where(eq(session.userId, change.memberId)));
    return changed;
  },
);

export const listAdmins = Effect.fn("listAdmins")(function* listAdmins(sessionId: string) {
  yield* requirePermission(sessionId, [ADMIN_PERMISSION.manage]);
  return yield* query((database) =>
    database
      .select({
        accountState: user.accountState,
        email: user.email,
        id: user.id,
        name: user.name,
        permission: user.permission,
      })
      .from(user)
      .where(and(eq(user.role, ROLE.administrator), liveAdmin(database, sessionId)))
      .orderBy(desc(user.createdAt), user.id),
  );
});

export const inviteAdmin = Effect.fn("inviteAdmin")(function* inviteAdmin(draft: {
  readonly email: string;
  readonly permission: AdminPermission;
  readonly sessionId: string;
}) {
  const actor = yield* requirePermission(draft.sessionId, [ADMIN_PERMISSION.manage]);
  return yield* issueInvite({
    action: AUDIT_ACTION.adminInvited,
    audience: APPLICATION.admin,
    email: draft.email,
    inviterId: actor.user.id,
    permission: draft.permission,
  });
});

export const setAdminPermission = Effect.fn("setAdminPermission")(function* setAdminPermission(
  change: {
    readonly permission: AdminPermission;
    readonly sessionId: string;
    readonly adminId: string;
  },
) {
  const actor = yield* requirePermission(change.sessionId, [ADMIN_PERMISSION.manage]);
  const [, changedAdmins] = yield* query(async (database) => {
    const audit = database.run(
      auditWhenTargeted(database, {
        action: AUDIT_ACTION.adminPermissionChanged,
        actorId: actor.user.id,
        sessionId: change.sessionId,
        targetId: change.adminId,
      }),
    );
    const permissionChange = database
      .update(user)
      .set({ permission: change.permission, updatedAt: new Date() })
      .where(
        and(
          eq(user.id, change.adminId),
          eq(user.role, ROLE.administrator),
          liveAdmin(database, change.sessionId),
        ),
      )
      .returning({ id: user.id, permission: user.permission });
    return database.batch([audit, permissionChange] as const);
  }).pipe(protectLastAdmin);
  const [changed] = changedAdmins;
  if (!changed) {
    return yield* new TargetUnavailable();
  }
  return changed;
});

export const disableAdmin = Effect.fn("disableAdmin")(function* disableAdmin(
  sessionId: string,
  adminId: string,
) {
  const actor = yield* requirePermission(sessionId, [ADMIN_PERMISSION.manage]);
  if (actor.user.id === adminId) {
    return yield* new TargetUnavailable();
  }
  const [, disabledAdmins] = yield* query(async (database) => {
    const audit = database.run(
      auditWhenTargeted(database, {
        action: AUDIT_ACTION.adminDisabled,
        actorId: actor.user.id,
        sessionId,
        targetId: adminId,
      }),
    );
    const disabling = database
      .update(user)
      .set({ accountState: ACCOUNT_STATE.suspended, updatedAt: new Date() })
      .where(
        and(
          eq(user.id, adminId),
          eq(user.role, ROLE.administrator),
          eq(user.accountState, ACCOUNT_STATE.active),
          liveAdmin(database, sessionId),
        ),
      )
      .returning({ id: user.id });
    return database.batch([audit, disabling] as const);
  }).pipe(protectLastAdmin);
  const [disabled] = disabledAdmins;
  if (!disabled) {
    return yield* new TargetUnavailable();
  }
  yield* query((database) => database.delete(session).where(eq(session.userId, adminId)));
  return disabled;
});

export const deleteUser = Effect.fn("deleteUser")(function* deleteUser(
  sessionId: string,
  targetId: string,
) {
  const actor = yield* requireAdmin(sessionId);
  const change = {
    action: AUDIT_ACTION.userDeleted,
    actorId: actor.user.id,
    sessionId,
    targetId,
  } as const;

  const [, removedUsers] = yield* query(async (database) => {
    const audit = database.run(auditWhenTargeted(database, change));
    const removal = database
      .delete(user)
      .where(and(eq(user.id, targetId), liveAdmin(database, sessionId)))
      .returning({ id: user.id });
    return database.batch([audit, removal] as const);
  }).pipe(protectLastAdmin);
  const [removed] = removedUsers;
  if (!removed) {
    return yield* new TargetUnavailable();
  }
  return removed;
});

export { AdminStrongSessionRequired } from "./admin-strong-session-required.ts";
export { InviteRejected } from "./invite-rejected.ts";
export { LastAdminRequired } from "./last-admin-required.ts";
export { OperationForbidden } from "./operation-forbidden.ts";
export { TargetUnavailable } from "./target-unavailable.ts";
