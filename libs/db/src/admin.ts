import { and, count, desc, eq, exists, gt, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import * as v from "valibot";
import { roles, strongAuthenticationMethods } from "@template/config";
import type { Role } from "@template/config";
import type { Database } from "./index.ts";
import { auditEvent, session, user } from "./schema.ts";
import { getSessionSecurity } from "./security.ts";
import { bootstrapStatement } from "./bootstrap-statement.ts";

function reportMutationFailure(error: unknown): never {
  for (let current: unknown = error; current instanceof Error; current = current.cause) {
    if (current.message.includes("LAST_ADMIN_REQUIRED")) throw new Error("LAST_ADMIN_REQUIRED");
  }
  throw error;
}

async function requireAdmin(database: Database, sessionId: string) {
  const actor = await getSessionSecurity(database, sessionId, "admin");
  if (
    !actor ||
    actor.user.role !== "admin" ||
    !actor.user.emailVerified ||
    !v.is(v.picklist(strongAuthenticationMethods), actor.session.authenticationMethod)
  ) {
    throw new Error("ADMIN_STRONG_SESSION_REQUIRED");
  }
  return actor;
}

function liveAdmin(database: Database, sessionId: string) {
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
          inArray(session.authenticationMethod, strongAuthenticationMethods),
        ),
      ),
  );
}

const pageInput = v.strictObject({
  limit: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100)), 50),
  offset: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0)), 0),
});

export async function listUsers(database: Database, sessionId: string, input: unknown = {}) {
  await requireAdmin(database, sessionId);
  const page = v.parse(pageInput, input);
  const users = await database
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
    .offset(page.offset);
  const [total] = await database
    .select({ count: count() })
    .from(user)
    .where(liveAdmin(database, sessionId));
  return { users, total: total?.count ?? 0 };
}

export async function setUserRole(
  database: Database,
  sessionId: string,
  targetId: string,
  role: Role,
) {
  v.parse(v.picklist(roles), role);
  const actor = await requireAdmin(database, sessionId);
  const [updated] = await database
    .update(user)
    .set({ role, updatedAt: new Date() })
    .where(and(eq(user.id, targetId), liveAdmin(database, sessionId)))
    .returning({ id: user.id, role: user.role })
    .catch(reportMutationFailure);
  if (!updated) throw new Error("USER_NOT_FOUND_OR_AUTHORITY_REVOKED");
  await database.insert(auditEvent).values({
    id: crypto.randomUUID(),
    actorId: actor.user.id,
    targetId,
    action: "role_changed",
    createdAt: new Date(),
  });
  return updated;
}

export async function deleteUser(database: Database, sessionId: string, targetId: string) {
  const actor = await requireAdmin(database, sessionId);
  const [removed] = await database
    .delete(user)
    .where(and(eq(user.id, targetId), liveAdmin(database, sessionId)))
    .returning({ id: user.id })
    .catch(reportMutationFailure);
  if (!removed) throw new Error("USER_NOT_FOUND_OR_AUTHORITY_REVOKED");
  await database.insert(auditEvent).values({
    id: crypto.randomUUID(),
    actorId: actor.user.id,
    targetId,
    action: "user_deleted",
    createdAt: new Date(),
  });
  return removed;
}

export async function bootstrapAdmin(database: Database, email: string) {
  const [updated] = await database.all<{ id: string; email: string; role: Role }>(
    bootstrapStatement(email),
  );
  if (!updated) throw new Error("BOOTSTRAP_REQUIRES_VERIFIED_USER_AND_NO_ADMIN");
  return updated;
}
