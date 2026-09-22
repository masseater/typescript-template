import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const boardThread = sqliteTable(
  "board_thread",
  {
    authorId: text("author_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    id: text("id").primaryKey().notNull(),
    lastPostedAt: integer("last_posted_at", { mode: "timestamp_ms" }).notNull(),
    postCount: integer("post_count").notNull().default(0),
    title: text("title").notNull(),
  },
  (table) => [index("board_thread_last_posted_at_idx").on(table.lastPostedAt, table.id)],
);

const boardPost = sqliteTable(
  "board_post",
  {
    authorId: text("author_id"),
    body: text("body").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    id: text("id").primaryKey().notNull(),
    threadId: text("thread_id")
      .notNull()
      .references(() => boardThread.id, { onDelete: "cascade" }),
  },
  (table) => [index("board_post_thread_id_idx").on(table.threadId, table.createdAt, table.id)],
);

export { boardPost, boardThread };
