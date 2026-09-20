import { sql } from "drizzle-orm";
import { check, index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./identity-schema.ts";

const onboardingSteps = ["agreement", "choose", "profile", "interview", "done"] as const;

const memberOnboarding = sqliteTable(
  "member_onboarding",
  {
    step: text("step", { enum: onboardingSteps }).notNull().default("agreement"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    userId: text("user_id")
      .primaryKey()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    check(
      "member_onboarding_step",
      sql`${table.step} IN ('agreement', 'choose', 'profile', 'interview', 'done')`,
    ),
  ],
);

const follow = sqliteTable(
  "follow",
  {
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    followeeId: text("followee_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    followerId: text("follower_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.followerId, table.followeeId] }),
    index("follow_followee_id_idx").on(table.followeeId),
  ],
);

export { follow, memberOnboarding, onboardingSteps };
