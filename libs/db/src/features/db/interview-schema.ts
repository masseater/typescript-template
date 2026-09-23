import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./identity-schema.ts";

const interview = sqliteTable("interview", {
  day: text("day").notNull(),
  savedSheet: text("saved_sheet", { mode: "json" }),
  state: text("state", { mode: "json" }).notNull(),
  turns: integer("turns").notNull().default(0),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(0),
});

export { interview };
