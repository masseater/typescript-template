import { sql, type SQL } from "drizzle-orm";

import { auditEvent, type AuditAction } from "./schema.ts";

interface AuditedChange {
  readonly action: AuditAction;
  readonly actorId: string;
  readonly targetId: string;
}

const auditWhen = (change: AuditedChange, targeted: SQL): SQL => {
  const auditColumns = [
    [auditEvent.action, change.action],
    [auditEvent.actorId, change.actorId],
    [auditEvent.createdAt, Date.now()],
    [auditEvent.id, crypto.randomUUID()],
    [auditEvent.targetId, change.targetId],
  ] as const;
  const columnNames = sql.join(
    auditColumns.map(([column]) => sql.identifier(column.name)),
    sql`, `,
  );
  const columnValues = sql.join(
    auditColumns.map(([, columnValue]) => sql`${columnValue}`),
    sql`, `,
  );
  return sql`INSERT INTO ${auditEvent} (${columnNames}) SELECT ${columnValues} WHERE EXISTS (${targeted})`;
};

export { auditWhen };
export type { AuditedChange };
