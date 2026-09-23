import { memberMcpCapabilities } from "@repo/config";
import { primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./identity-schema.ts";

const memberMcpGrant = sqliteTable(
  "member_mcp_grant",
  {
    capability: text("capability", { enum: memberMcpCapabilities }).notNull(),
    memberId: text("member_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.memberId, table.capability] })],
);

export { memberMcpGrant };
