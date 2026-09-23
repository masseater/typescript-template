import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const apikey = sqliteTable(
  "apikey",
  {
    configId: text("config_id").notNull().default("default"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    enabled: integer("enabled", { mode: "boolean" }).default(true),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    id: text("id").notNull().primaryKey(),
    key: text("key").notNull(),
    lastRefillAt: integer("last_refill_at", { mode: "timestamp_ms" }),
    lastRequest: integer("last_request", { mode: "timestamp_ms" }),
    metadata: text("metadata"),
    name: text("name"),
    permissions: text("permissions"),
    prefix: text("prefix"),
    rateLimitEnabled: integer("rate_limit_enabled", { mode: "boolean" }).default(true),
    rateLimitMax: integer("rate_limit_max").default(60),
    rateLimitTimeWindow: integer("rate_limit_time_window").default(60_000),
    referenceId: text("reference_id").notNull(),
    refillAmount: integer("refill_amount"),
    refillInterval: integer("refill_interval"),
    remaining: integer("remaining"),
    requestCount: integer("request_count").default(0),
    start: text("start"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },

  (table) => [
    index("apikey_config_id_idx").on(table.configId),
    index("apikey_key_idx").on(table.key),
    index("apikey_reference_id_idx").on(table.referenceId),
  ],
);

export { apikey };
