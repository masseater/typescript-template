import type { Database, Role } from "./index.ts";
import { and, count, desc, eq, exists, gt, inArray } from "drizzle-orm";
import { auditEvent, session, user } from "./schema.ts";
import {
  integer,
  maxValue,
  minValue,
  number,
  optional,
  parse,
  picklist,
  pipe,
  strictObject,
} from "valibot";
import type { SQL } from "drizzle-orm";
import type { SessionSecurity } from "./security.ts";
import { alias } from "drizzle-orm/sqlite-core";
import { bootstrapStatement } from "./bootstrap-statement.ts";
import { getSessionSecurity } from "./security.ts";

type ManagedUser = Pick<
  typeof user.$inferSelect,
  "createdAt" | "email" | "emailVerified" | "id" | "name" | "profile" | "role"
>;
interface UserPage {
  total: number;
  users: ManagedUser[];
}
type AuditAction = typeof auditEvent.$inferInsert.action;

const PAGE_LIMIT_MAX = 100;
const PAGE_LIMIT_DEFAULT = 50;
const strongMethods = ["password_totp", "passkey_uv"] as const;

const pageLimitSchema = pipe(number(), integer(), minValue(1), maxValue(PAGE_LIMIT_MAX));
const pageOffsetSchema = pipe(number(), integer(), minValue(0));
const pageInput = strictObject({
  limit: optional(pageLimitSchema, PAGE_LIMIT_DEFAULT),
  offset: optional(pageOffsetSchema, 0),
});
const roleSchema = picklist(["user", "admin"]);

function reportMutationFailure(error: unknown): never {
  for (let current: unknown = error; current instanceof Error; current = current.cause) {
    if (current.message.includes("LAST_ADMIN_REQUIRED")) {
      throw new Error("LAST_ADMIN_REQUIRED");
    }
  }
  throw error;
}

async function requireAdmin(database: Database, sessionId: string): Promise<SessionSecurity> {
  const actor = await getSessionSecurity(database, sessionId, "admin");
  if (
    actor?.user.role !== "admin" ||
    !actor.user.emailVerified ||
    !strongMethods.some((method) => method === actor.session.authenticationMethod)
  ) {
    throw new Error("ADMIN_STRONG_SESSION_REQUIRED");
  }
  return actor;
}

function liveAdmin(database: Database, sessionId: string): SQL {
  const actor = alias(user, "actor");
  const unexpired = gt(session.expiresAt, new Date());
  const strongSession = inArray(session.authenticationMethod, [...strongMethods]);
  const liveAdminSession = and(
    eq(session.id, sessionId),
    eq(session.audience, "admin"),
    eq(actor.role, "admin"),
    eq(actor.emailVerified, true),
    eq(session.securityVersion, actor.securityVersion),
    unexpired,
    strongSession,
  );
  const sessionOwner = eq(session.userId, actor.id);
  return exists(
    database
      .select({ id: session.id })
      .from(session)
      .innerJoin(actor, sessionOwner)
      .where(liveAdminSession),
  );
}

async function recordAudit(
  database: Database,
  event: Readonly<{ action: AuditAction; actorId: string; targetId: string }>,
): Promise<void> {
  await database.insert(auditEvent).values({
    ...event,
    createdAt: new Date(),
    id: crypto.randomUUID(),
  });
}

async function listUsers(
  database: Database,
  sessionId: string,
  input: unknown = {},
): Promise<UserPage> {
  await requireAdmin(database, sessionId);
  const page = parse(pageInput, input);
  const users = await database
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
    .offset(page.offset);
  const [total] = await database
    .select({ count: count() })
    .from(user)
    .where(liveAdmin(database, sessionId));
  return { total: total?.count ?? 0, users };
}

async function setUserRole({
  database,
  role,
  sessionId,
  targetId,
}: Readonly<{
  database: Database;
  role: Role;
  sessionId: string;
  targetId: string;
}>): Promise<{ id: string; role: Role }> {
  parse(roleSchema, role);
  const actor = await requireAdmin(database, sessionId);
  const [updated] = await database
    .update(user)
    .set({ role, updatedAt: new Date() })
    .where(and(eq(user.id, targetId), liveAdmin(database, sessionId)))
    .returning({ id: user.id, role: user.role })
    .catch(reportMutationFailure);
  if (!updated) {
    throw new Error("USER_NOT_FOUND_OR_AUTHORITY_REVOKED");
  }
  await recordAudit(database, { action: "role_changed", actorId: actor.user.id, targetId });
  return updated;
}

async function deleteUser(
  database: Database,
  sessionId: string,
  targetId: string,
): Promise<{ id: string }> {
  const actor = await requireAdmin(database, sessionId);
  const [removed] = await database
    .delete(user)
    .where(and(eq(user.id, targetId), liveAdmin(database, sessionId)))
    .returning({ id: user.id })
    .catch(reportMutationFailure);
  if (!removed) {
    throw new Error("USER_NOT_FOUND_OR_AUTHORITY_REVOKED");
  }
  await recordAudit(database, { action: "user_deleted", actorId: actor.user.id, targetId });
  return removed;
}

async function bootstrapAdmin(
  database: Database,
  address: string,
): Promise<{ email: string; id: string; role: Role }> {
  const [updated] = await database.all<{ email: string; id: string; role: Role }>(
    bootstrapStatement(address),
  );
  if (!updated) {
    throw new Error("BOOTSTRAP_REQUIRES_VERIFIED_USER_AND_NO_ADMIN");
  }
  return updated;
}

export { bootstrapAdmin, deleteUser, listUsers, setUserRole };
