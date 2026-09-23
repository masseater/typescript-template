import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./identity-schema.ts";

const wikiDraft = sqliteTable("wiki_draft", {
  baseRevision: text("base_revision"),
  markdown: text("markdown").notNull(),
  path: text("path").primaryKey().notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
  version: integer("version").notNull().default(1),
});

export { wikiDraft };
