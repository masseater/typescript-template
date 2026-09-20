import { sql } from "drizzle-orm";
import { check, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { user } from "./identity-schema.ts";

/** @canonical-values db.agreement-kind */
const agreementKinds = ["terms", "privacy", "interview_history", "analytics"] as const;
type AgreementKind = (typeof agreementKinds)[number];

const agreementVersion = sqliteTable(
  "agreement_version",
  {
    body: text("body").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    id: text("id").primaryKey(),
    kind: text("kind", { enum: agreementKinds }).notNull(),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
    summary: text("summary"),
    version: text("version").notNull(),
  },
  (table) => [
    uniqueIndex("agreement_version_version_unique").on(table.version),
    check(
      "agreement_version_kind",
      sql`${table.kind} IN ('terms', 'privacy', 'interview_history', 'analytics')`,
    ),
  ],
);

const agreementAcceptance = sqliteTable(
  "agreement_acceptance",
  {
    acceptedAt: integer("accepted_at", { mode: "timestamp_ms" }).notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    versionId: text("version_id")
      .notNull()
      .references(() => agreementVersion.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.versionId] })],
);

export { agreementAcceptance, agreementKinds, agreementVersion };
export type { AgreementKind };
