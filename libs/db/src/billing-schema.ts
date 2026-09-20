import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { user } from "./identity-schema.ts";

/** @canonical-values db.plan */
const plans = ["free", "paid"] as const;
type Plan = (typeof plans)[number];
const PLAN = { free: plans[0], paid: plans[1] } as const satisfies Record<string, Plan>;

/** @canonical-values db.subscription-status */
const subscriptionStatuses = [
  "active",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "past_due",
  "paused",
  "trialing",
  "unpaid",
] as const;
type SubscriptionStatus = (typeof subscriptionStatuses)[number];
const SUBSCRIPTION_STATUS = {
  active: subscriptionStatuses[0],
  canceled: subscriptionStatuses[1],
  incomplete: subscriptionStatuses[2],
  incompleteExpired: subscriptionStatuses[3],
  pastDue: subscriptionStatuses[4],
  paused: subscriptionStatuses[5],
  trialing: subscriptionStatuses[6],
  unpaid: subscriptionStatuses[7],
} as const satisfies Record<string, SubscriptionStatus>;

const paidStatuses: readonly SubscriptionStatus[] = [
  SUBSCRIPTION_STATUS.active,
  SUBSCRIPTION_STATUS.trialing,
];

const planSubscription = sqliteTable(
  "plan_subscription",
  {
    cancelAtPeriodEnd: integer("cancel_at_period_end", { mode: "boolean" })
      .notNull()
      .default(false),
    currentPeriodEnd: integer("current_period_end", { mode: "timestamp_ms" }),
    memberId: text("member_id")
      .primaryKey()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status", { enum: subscriptionStatuses }).notNull(),
    stripeCustomerId: text("stripe_customer_id").notNull(),
    stripeSubscriptionId: text("stripe_subscription_id").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("plan_subscription_stripe_customer_id_unique").on(table.stripeCustomerId),
    uniqueIndex("plan_subscription_stripe_subscription_id_unique").on(table.stripeSubscriptionId),
    check(
      "plan_subscription_status",
      sql`${table.status} IN ('active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'paused', 'trialing', 'unpaid')`,
    ),
  ],
);

const stripeEvent = sqliteTable("stripe_event", {
  id: text("id").primaryKey().notNull(),
  receivedAt: integer("received_at", { mode: "timestamp_ms" }).notNull(),
  type: text("type").notNull(),
});

export {
  PLAN,
  SUBSCRIPTION_STATUS,
  paidStatuses,
  planSubscription,
  plans,
  stripeEvent,
  subscriptionStatuses,
};
export type { Plan, SubscriptionStatus };
