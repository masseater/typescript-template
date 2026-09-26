import { exists, sql, type SQL, type SQLWrapper } from "drizzle-orm";
import { DateTime } from "effect";

import { AUDIT_CHANNEL, auditEvent, user, type AuditAction, type AuditChannel } from "./schema.ts";

import type { Role } from "@repo/config";
import type { DrizzleDatabase } from "./database.ts";

const insertWhere = (
  columns: readonly (readonly [{ readonly name: string }, unknown])[],
  condition: SQLWrapper,
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

const auditWhen = (
  change: Readonly<{
    action: AuditAction;
    actorId: string;
    id: string;
    targetId: string;
  }>,
  targeted: SQLWrapper,
): SQL =>
  insertWhere(
    [
      [auditEvent.action, change.action],
      [auditEvent.actorId, change.actorId],
      [auditEvent.createdAt, DateTime.toEpochMillis(DateTime.nowUnsafe())],
      [auditEvent.id, change.id],
      [auditEvent.targetId, change.targetId],
    ],
    sql`EXISTS (${targeted})`,
  );

type AuditEntry = Readonly<{
  action: AuditAction;
  actorId: string;
  actorKind: Role;
  channel?: AuditChannel;
  targetId: string;
}>;

const auditRow = (
  auditEntry: AuditEntry & Readonly<{ id: string }>,
): typeof auditEvent.$inferInsert => ({
  action: auditEntry.action,
  actorId: auditEntry.actorId,
  actorKind: auditEntry.actorKind,
  channel: auditEntry.channel ?? AUDIT_CHANNEL.ui,
  createdAt: DateTime.toDate(DateTime.nowUnsafe()),
  id: auditEntry.id,
  targetId: auditEntry.targetId,
});

const auditWhenTargeted = (
  database: DrizzleDatabase,
  {
    actorIsLive,
    entry: auditEntry,
    id,
  }: Readonly<{ actorIsLive: SQLWrapper; entry: AuditEntry; id: string }>,
): SQL => {
  const targeted = database
    .select({ id: user.id })
    .from(user)
    .where(sql`${user.id} = ${auditEntry.targetId} AND ${actorIsLive}`);
  return insertWhere(
    [
      [auditEvent.action, auditEntry.action],
      [auditEvent.actorId, auditEntry.actorId],
      [auditEvent.actorKind, auditEntry.actorKind],
      [auditEvent.channel, auditEntry.channel ?? AUDIT_CHANNEL.ui],
      [auditEvent.createdAt, DateTime.toEpochMillis(DateTime.nowUnsafe())],
      [auditEvent.id, id],
      [auditEvent.targetId, auditEntry.targetId],
    ],
    exists(targeted),
  );
};

export { auditRow, auditWhen, auditWhenTargeted };
export type { AuditEntry };
