import { and, count, desc, eq, exists, gt, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { Effect, Schema } from "effect";
import { DatabaseFailure, query } from "./index.ts";
import type { DrizzleDatabase, Role } from "./index.ts";
import { auditEvent, session, user } from "./schema.ts";
import { getSessionSecurity } from "./security.ts";

export class AdminStrongSessionRequired extends Schema.TaggedError<AdminStrongSessionRequired>()(
  "AdminStrongSessionRequired",
  {},
) {}

export class LastAdminRequired extends Schema.TaggedError<LastAdminRequired>()(
  "LastAdminRequired",
  {},
) {}

export class TargetUnavailable extends Schema.TaggedError<TargetUnavailable>()(
  "TargetUnavailable",
  {},
) {}

export const UserPage = Schema.Struct({
  limit: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 100 })),
  offset: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

const mentionsLastAdmin = (failure: DatabaseFailure) => {
  for (let current: unknown = failure.cause; current instanceof Error; current = current.cause)
    if (current.message.includes("LAST_ADMIN_REQUIRED")) return true;
  return false;
};

const protectLastAdmin = <A, R>(effect: Effect.Effect<A, DatabaseFailure, R>) =>
  effect.pipe(
    Effect.mapError((failure) => (mentionsLastAdmin(failure) ? new LastAdminRequired() : failure)),
  );

const requireAdmin = Effect.fn("requireAdmin")(function* (sessionId: string) {
  const actor = yield* getSessionSecurity(sessionId, "admin");
  if (
    !actor ||
    actor.user.role !== "admin" ||
    !actor.user.emailVerified ||
    !["password_totp", "passkey_uv"].includes(actor.session.authenticationMethod)
  )
    return yield* new AdminStrongSessionRequired();
  return actor;
});

function liveAdmin(database: DrizzleDatabase, sessionId: string) {
  const actor = alias(user, "actor");
  return exists(
    database
      .select({ id: session.id })
      .from(session)
      .innerJoin(actor, eq(session.userId, actor.id))
      .where(
        and(
          eq(session.id, sessionId),
          eq(session.audience, "admin"),
          eq(actor.role, "admin"),
          eq(actor.emailVerified, true),
          eq(session.securityVersion, actor.securityVersion),
          gt(session.expiresAt, new Date()),
          inArray(session.authenticationMethod, ["password_totp", "passkey_uv"]),
        ),
      ),
  );
}

export const listUsers = Effect.fn("listUsers")(function* (
  sessionId: string,
  page: typeof UserPage.Type,
) {
  yield* requireAdmin(sessionId);
  const users = yield* query((database) =>
    database
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        profile: user.profile,
        role: user.role,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(liveAdmin(database, sessionId))
      .orderBy(desc(user.createdAt), user.id)
      .limit(page.limit)
      .offset(page.offset),
  );
  const [total] = yield* query((database) =>
    database.select({ count: count() }).from(user).where(liveAdmin(database, sessionId)),
  );
  return { users, total: total?.count ?? 0 };
});

const recordAudit = (actorId: string, targetId: string, action: "role_changed" | "user_deleted") =>
  query((database) =>
    database.insert(auditEvent).values({
      id: crypto.randomUUID(),
      actorId,
      targetId,
      action,
      createdAt: new Date(),
    }),
  );

export const setUserRole = Effect.fn("setUserRole")(function* (
  sessionId: string,
  targetId: string,
  role: Role,
) {
  const actor = yield* requireAdmin(sessionId);
  const [updated] = yield* query((database) =>
    database
      .update(user)
      .set({ role, updatedAt: new Date() })
      .where(and(eq(user.id, targetId), liveAdmin(database, sessionId)))
      .returning({ id: user.id, role: user.role }),
  ).pipe(protectLastAdmin);
  if (!updated) return yield* new TargetUnavailable();
  yield* recordAudit(actor.user.id, targetId, "role_changed");
  return updated;
});

export const deleteUser = Effect.fn("deleteUser")(function* (sessionId: string, targetId: string) {
  const actor = yield* requireAdmin(sessionId);
  const [removed] = yield* query((database) =>
    database
      .delete(user)
      .where(and(eq(user.id, targetId), liveAdmin(database, sessionId)))
      .returning({ id: user.id }),
  ).pipe(protectLastAdmin);
  if (!removed) return yield* new TargetUnavailable();
  yield* recordAudit(actor.user.id, targetId, "user_deleted");
  return removed;
});
