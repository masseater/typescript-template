import { subscriptionStatuses } from "@repo/config";
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

const customerInvoice = sqliteTable(
  "customer_invoice",
  {
    amountCredited: integer("amount_credited").notNull().default(0),
    amountDue: integer("amount_due").notNull(),
    amountPaid: integer("amount_paid").notNull().default(0),
    amountRefunded: integer("amount_refunded").notNull().default(0),
    amountRemaining: integer("amount_remaining").notNull(),
    currency: text("currency").notNull(),
    hostedInvoiceUrl: text("hosted_invoice_url"),
    issuedAt: integer("issued_at", { mode: "timestamp_ms" }).notNull(),
    memberId: text("member_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    originKey: text("origin_key").notNull(),
    status: text("status").notNull(),
    stripeInvoiceId: text("stripe_invoice_id").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.stripeInvoiceId] }),
    uniqueIndex("customer_invoice_origin_key_unique").on(table.originKey),
    index("customer_invoice_member_id_idx").on(table.memberId),
  ],
);

export { customerInvoice, planSubscription, stripeEvent };
