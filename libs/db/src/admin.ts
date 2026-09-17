import { Effect, Schema } from "effect";
import { and, count, desc, eq } from "drizzle-orm";
import { auditEvent, user } from "./schema.ts";
import { liveAdmin, requireAdmin } from "./admin-session.ts";
import type { Database } from "./database.ts";
import type { DatabaseFailure } from "./database-failure.ts";
import { LastAdminRequired } from "./last-admin-required.ts";
import type { Role } from "@template/config";
import { TargetUnavailable } from "./target-unavailable.ts";
import { query } from "./database.ts";

const MAX_PAGE_SIZE = 100;

const UserPage = Schema.Struct({
  limit: Schema.Int.check(Schema.isBetween({ maximum: MAX_PAGE_SIZE, minimum: 1 })),
  offset: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

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
        profile: user.profile,
        role: user.role,
      })
      .from(user)
      .where(liveAdmin(database, sessionId))
      .orderBy(desc(user.createdAt), user.id)
      .limit(page.limit)
      .offset(page.offset),
  );
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  const [total] = yield* query((database) =>
    database.select({ count: count() }).from(user).where(liveAdmin(database, sessionId)),
  );
  return { total: total?.count ?? 0, users };
});

function recordAudit(
  actorId: string,
  targetId: string,
  action: "role_changed" | "user_deleted",
): Effect.Effect<void, DatabaseFailure, Database> {
  const event = { action, actorId, createdAt: new Date(), id: crypto.randomUUID(), targetId };
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  return query(async (database): Promise<void> => {
    await database.insert(auditEvent).values(event);
  });
}

const setUserRole = Effect.fn("setUserRole")(function* setUserRole(
  sessionId: string,
  targetId: string,
  role: Role,
) {
  const actor = yield* requireAdmin(sessionId);
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  const [updated] = yield* query((database) =>
    database
      .update(user)
      .set({ role, updatedAt: new Date() })
      .where(and(eq(user.id, targetId), liveAdmin(database, sessionId)))
      .returning({ id: user.id, role: user.role }),
  ).pipe(protectLastAdmin);
  if (!updated) {
    return yield* new TargetUnavailable();
  }
  yield* recordAudit(actor.user.id, targetId, "role_changed");
  return updated;
});

const deleteUser = Effect.fn("deleteUser")(function* deleteUser(
  sessionId: string,
  targetId: string,
) {
  const actor = yield* requireAdmin(sessionId);
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  const [removed] = yield* query((database) =>
    database
      .delete(user)
      .where(and(eq(user.id, targetId), liveAdmin(database, sessionId)))
      .returning({ id: user.id }),
  ).pipe(protectLastAdmin);
  if (!removed) {
    return yield* new TargetUnavailable();
  }
  yield* recordAudit(actor.user.id, targetId, "user_deleted");
  return removed;
});

export { AdminStrongSessionRequired } from "./admin-strong-session-required.ts";
export { LastAdminRequired } from "./last-admin-required.ts";
export { TargetUnavailable } from "./target-unavailable.ts";
export { UserPage, deleteUser, listUsers, setUserRole };
