import { roles, type Role } from "@repo/config";
import { and, count, desc, eq, or, sql, type SQL } from "drizzle-orm";
import { Effect, Schema } from "effect";

import { liveAdmin, requireAdmin } from "./admin-session.ts";
import { containsKeyword } from "./contains-keyword.ts";
import { query, type DrizzleDatabase } from "./database.ts";
import { LastAdminRequired } from "./last-admin-required.ts";
import { AUDIT_ACTION, auditEvent, user, type AuditAction } from "./schema.ts";
import { TargetUnavailable } from "./target-unavailable.ts";

import type { DatabaseFailure } from "./database-failure.ts";

const MAX_PAGE_SIZE = 100;

export const UserPage = Schema.Struct({
  emailVerified: Schema.optionalKey(Schema.Boolean),
  keyword: Schema.optionalKey(Schema.String),
  limit: Schema.Int.check(Schema.isBetween({ maximum: MAX_PAGE_SIZE, minimum: 1 })),
  offset: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  role: Schema.optionalKey(Schema.Literals(roles)),
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
  const { emailVerified, keyword, role } = page;
  return and(
    keyword === undefined
      ? undefined
      : or(containsKeyword(user.name, keyword), containsKeyword(user.email, keyword)),
    role === undefined ? undefined : eq(user.role, role),
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
        createdAt: user.createdAt,
        email: user.email,
        emailVerified: user.emailVerified,
        id: user.id,
        name: user.name,
        role: user.role,
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

export const setUserRole = Effect.fn("setUserRole")(function* setUserRole(roleChange: {
  readonly sessionId: string;
  readonly targetId: string;
  readonly role: Role;
}) {
  const { role, sessionId, targetId } = roleChange;
  const actor = yield* requireAdmin(sessionId);
  const change = {
    action: AUDIT_ACTION.roleChanged,
    actorId: actor.user.id,
    sessionId,
    targetId,
  } as const;

  const [, promotedUsers] = yield* query(async (database) => {
    const audit = database.run(auditWhenTargeted(database, change));
    const promotion = database
      .update(user)
      .set({ role, updatedAt: new Date() })
      .where(and(eq(user.id, targetId), liveAdmin(database, sessionId)))
      .returning({ id: user.id, role: user.role });
    return database.batch([audit, promotion] as const);
  }).pipe(protectLastAdmin);
  const [promoted] = promotedUsers;
  if (!promoted) {
    return yield* new TargetUnavailable();
  }
  return promoted;
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
export { LastAdminRequired } from "./last-admin-required.ts";
export { TargetUnavailable } from "./target-unavailable.ts";
