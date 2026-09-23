import { exists, sql, type SQL } from "drizzle-orm";
import { DateTime } from "effect";

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

interface AuditedChange {
  readonly action: AuditAction;
  readonly actorId: string;
  readonly targetId: string;
}

const auditRow = (entry: AuditEntry): typeof auditEvent.$inferInsert => ({
  action: entry.action,
  actorId: entry.actorId,
  actorKind: entry.actorKind,
  channel: entry.channel ?? AUDIT_CHANNEL.ui,
  createdAt: DateTime.toDate(DateTime.nowUnsafe()),
  id: crypto.randomUUID(),
  targetId: entry.targetId,
});

const insertWhere = (
  columns: ReadonlyArray<readonly [{ readonly name: string }, unknown]>,
  condition: SQL,
): SQL => {
  const columnNames = sql.join(
    columns.map(([column]) => sql.identifier(column.name)),
    sql`, `,
  );
  const columnValues = sql.join(
    columns.map(([, columnValue]) => sql`${columnValue}`),
    sql`, `,
  );
  return sql`INSERT INTO ${auditEvent} (${columnNames}) SELECT ${columnValues} WHERE ${condition}`;
};

const auditWhen = (change: AuditedChange, targeted: SQL): SQL =>
  insertWhere(
    [
      [auditEvent.action, change.action],
      [auditEvent.actorId, change.actorId],
      [auditEvent.createdAt, DateTime.toEpochMillis(DateTime.nowUnsafe())],
      [auditEvent.id, crypto.randomUUID()],
      [auditEvent.targetId, change.targetId],
    ],
    sql`EXISTS (${targeted})`,
  );

const auditWhenTargeted = (database: DrizzleDatabase, entry: AuditEntry, actorIsLive: SQL): SQL => {
  const targeted = database
    .select({ id: user.id })
    .from(user)
    .where(sql`${user.id} = ${entry.targetId} AND ${actorIsLive}`);
  return insertWhere(
    [
      [auditEvent.action, entry.action],
      [auditEvent.actorId, entry.actorId],
      [auditEvent.actorKind, entry.actorKind],
      [auditEvent.channel, entry.channel ?? AUDIT_CHANNEL.ui],
      [auditEvent.createdAt, DateTime.toEpochMillis(DateTime.nowUnsafe())],
      [auditEvent.id, crypto.randomUUID()],
      [auditEvent.targetId, entry.targetId],
    ],
    exists(targeted),
  );
};

export { auditRow, auditWhen, auditWhenTargeted };
export type { AuditEntry };
