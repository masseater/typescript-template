import { exists, sql, type SQL } from "drizzle-orm";

import { AUDIT_CHANNEL, auditEvent, user, type AuditAction, type AuditChannel } from "./schema.ts";

import type { Role } from "@repo/config";
import type { DrizzleDatabase } from "./database.ts";

type AuditEntry = Readonly<{
  action: AuditAction;
  actorId: string;
  actorKind: Role;
  channel?: AuditChannel;
  targetId: string;
}>;

const auditRow = (entry: AuditEntry): typeof auditEvent.$inferInsert => ({
  action: entry.action,
  actorId: entry.actorId,
  actorKind: entry.actorKind,
  channel: entry.channel ?? AUDIT_CHANNEL.ui,
  createdAt: new Date(),
  id: crypto.randomUUID(),
  targetId: entry.targetId,
});

const auditWhenTargeted = (database: DrizzleDatabase, entry: AuditEntry, actorIsLive: SQL): SQL => {
  const channel = entry.channel ?? AUDIT_CHANNEL.ui;
  const columns = [
    [auditEvent.action, entry.action],
    [auditEvent.actorId, entry.actorId],
    [auditEvent.actorKind, entry.actorKind],
    [auditEvent.channel, channel],
    [auditEvent.createdAt, Date.now()],
    [auditEvent.id, crypto.randomUUID()],
    [auditEvent.targetId, entry.targetId],
  ] as const;
  const columnNames = sql.join(
    columns.map(([column]) => sql.identifier(column.name)),
    sql`, `,
  );
  const columnValues = sql.join(
    columns.map(([, columnValue]) => sql`${columnValue}`),
    sql`, `,
  );
  const targeted = database
    .select({ id: user.id })
    .from(user)
    .where(sql`${user.id} = ${entry.targetId} AND ${actorIsLive}`);
  return sql`INSERT INTO ${auditEvent} (${columnNames}) SELECT ${columnValues} WHERE ${exists(targeted)}`;
};

export { auditRow, auditWhenTargeted };
export type { AuditEntry };
