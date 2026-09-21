import { agreementKinds } from "@repo/config";
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { user } from "./identity-schema.ts";

const agreementVersion = sqliteTable(
  "agreement_version",
  {
    body: text("body").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    id: text("id").primaryKey(),
    kind: text("kind", { enum: agreementKinds }).notNull(),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
    publishedBy: text("published_by").references(() => user.id, { onDelete: "set null" }),
    summary: text("summary"),
    version: text("version").notNull(),
  },
  (table) => [
    uniqueIndex("agreement_version_version_unique").on(table.version),
    index("agreement_version_kind_published_at_idx").on(table.kind, table.publishedAt),
    check("agreement_version_kind", sql`${table.kind} IN ('terms', 'privacy')`),
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
      .references(() => agreementVersion.id, { onDelete: "restrict" }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.versionId] })],
);

export { agreementAcceptance, agreementVersion };
