import { Effect, Schema } from "effect";
import { and, count, desc, eq, or, sql } from "drizzle-orm";
import { auditEvent, user } from "./schema.ts";
import { liveAdmin, requireAdmin } from "./admin-session.ts";
import type { DatabaseFailure } from "./database-failure.ts";
import type { DrizzleDatabase } from "./database.ts";
import { LastAdminRequired } from "./last-admin-required.ts";
import type { Role } from "@repo/config";
import type { SQL } from "drizzle-orm";
import { TargetUnavailable } from "./target-unavailable.ts";
import { containsKeyword } from "./contains-keyword.ts";
import { query } from "./database.ts";
import { roles } from "@repo/config";

const MAX_PAGE_SIZE = 100;

const UserPage = Schema.Struct({
  emailVerified: Schema.optionalKey(Schema.Boolean),
  keyword: Schema.optionalKey(Schema.String),
  limit: Schema.Int.check(Schema.isBetween({ maximum: MAX_PAGE_SIZE, minimum: 1 })),
  offset: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  role: Schema.optionalKey(Schema.Literals(roles)),
});

function matchesPage(page: typeof UserPage.Type): SQL | undefined {
  const { emailVerified, keyword, role } = page;
  return and(
    keyword === undefined
      ? undefined
      : or(containsKeyword(user.name, keyword), containsKeyword(user.email, keyword)),
    role === undefined ? undefined : eq(user.role, role),
    emailVerified === undefined ? undefined : eq(user.emailVerified, emailVerified),
  );
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function mentionsLastAdmin(failure: DatabaseFailure): boolean {
  for (let current: unknown = failure.cause; current instanceof Error; current = current.cause) {
    if (current.message.includes("LAST_ADMIN_REQUIRED")) {
      return true;
    }
  }
  return false;
}

function protectLastAdmin<Value, Requirements>(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  effect: Effect.Effect<Value, DatabaseFailure, Requirements>,
): Effect.Effect<Value, DatabaseFailure | LastAdminRequired, Requirements> {
  return effect.pipe(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    Effect.mapError((failure) => (mentionsLastAdmin(failure) ? new LastAdminRequired() : failure)),
  );
}

const listUsers = Effect.fn("listUsers")(function* listUsers(
  sessionId: string,
  page: typeof UserPage.Type,
) {
  yield* requireAdmin(sessionId);
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
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
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  const [total] = yield* query((database) =>
    database
      .select({ count: count() })
      .from(user)
      .where(and(liveAdmin(database, sessionId), matchesPage(page))),
  );
  return { total: total?.count ?? 0, users };
});

function auditWhenTargeted(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  database: DrizzleDatabase,
  {
    action,
    actorId,
    sessionId,
    targetId,
  }: Readonly<{
    action: "role_changed" | "user_deleted";
    actorId: string;
    sessionId: string;
    targetId: string;
  }>,
): SQL {
  const record = [
    [auditEvent.action, action],
    [auditEvent.actorId, actorId],
    [auditEvent.createdAt, Date.now()],
    [auditEvent.id, crypto.randomUUID()],
    [auditEvent.targetId, targetId],
  ] as const;
  const names = sql.join(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    record.map(([column]) => sql.identifier(column.name)),
    sql`, `,
  );
  const values = sql.join(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    record.map(([, value]) => sql`${value}`),
    sql`, `,
  );
  const targeted = sql`SELECT 1 FROM ${user} WHERE ${user.id} = ${targetId} AND ${liveAdmin(database, sessionId)}`;
  return sql`INSERT INTO ${auditEvent} (${names}) SELECT ${values} WHERE EXISTS (${targeted})`;
}

const setUserRole = Effect.fn("setUserRole")(function* setUserRole(
  sessionId: string,
  targetId: string,
  role: Role,
) {
  const actor = yield* requireAdmin(sessionId);
  const change = { action: "role_changed", actorId: actor.user.id, sessionId, targetId } as const;
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  const [, rows] = yield* query(async (database) => {
    const audit = database.run(auditWhenTargeted(database, change));
    const promotion = database
      .update(user)
      .set({ role, updatedAt: new Date() })
      .where(and(eq(user.id, targetId), liveAdmin(database, sessionId)))
      .returning({ id: user.id, role: user.role });
    return database.batch([audit, promotion] as const);
  }).pipe(protectLastAdmin);
  const [updated] = rows;
  if (!updated) {
    return yield* new TargetUnavailable();
  }
  return updated;
});

const deleteUser = Effect.fn("deleteUser")(function* deleteUser(
  sessionId: string,
  targetId: string,
) {
  const actor = yield* requireAdmin(sessionId);
  const change = { action: "user_deleted", actorId: actor.user.id, sessionId, targetId } as const;
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  const [, rows] = yield* query(async (database) => {
    const audit = database.run(auditWhenTargeted(database, change));
    const removal = database
      .delete(user)
      .where(and(eq(user.id, targetId), liveAdmin(database, sessionId)))
      .returning({ id: user.id });
    return database.batch([audit, removal] as const);
  }).pipe(protectLastAdmin);
  const [removed] = rows;
  if (!removed) {
    return yield* new TargetUnavailable();
  }
  return removed;
});

export { AdminStrongSessionRequired } from "./admin-strong-session-required.ts";
export { LastAdminRequired } from "./last-admin-required.ts";
export { TargetUnavailable } from "./target-unavailable.ts";
export { UserPage, deleteUser, listUsers, setUserRole };
