import { PLAN, SUBSCRIPTION_STATUS, WEBHOOK_OUTCOME, paidStatuses } from "@repo/config";
import { and, eq, lte } from "drizzle-orm";
import { DateTime, Effect } from "effect";

import { planSubscription, stripeEvent } from "./billing-schema.ts";
import { query } from "./database.ts";
import { PaidPlanRequired } from "./paid-plan-required.ts";

import type { Plan, SubscriptionStatus } from "@repo/config";
import type { BatchItem } from "drizzle-orm/batch";
import type { DrizzleDatabase } from "./database.ts";

interface StripeEventRecord {
  readonly createdAt: Date;
  readonly id: string;
  readonly type: string;
}

interface SubscriptionRecord {
  readonly cancelAtPeriodEnd: boolean;
  readonly currentPeriodEnd: Date | undefined;
  readonly memberId: string;
  readonly status: SubscriptionStatus;
  readonly stripeCustomerId: string;
  readonly stripeSubscriptionId: string;
}

interface PlanView {
  readonly cancelAtPeriodEnd: boolean;
  readonly currentPeriodEnd: Date | undefined;
  readonly plan: Plan;
  readonly status: SubscriptionStatus | undefined;
}

const clockDate = Effect.map(DateTime.now, DateTime.toDate);

const subscriptionColumns = {
  cancelAtPeriodEnd: planSubscription.cancelAtPeriodEnd,
  currentPeriodEnd: planSubscription.currentPeriodEnd,
  memberId: planSubscription.memberId,
  status: planSubscription.status,
  stripeCustomerId: planSubscription.stripeCustomerId,
  stripeSubscriptionId: planSubscription.stripeSubscriptionId,
};

const findSubscription = Effect.fn("findSubscription")(function* findSubscription(
  memberId: string,
) {
  const [row] = yield* query((database) =>
    database
      .select(subscriptionColumns)
      .from(planSubscription)
      .where(eq(planSubscription.memberId, memberId))
      .limit(1),
  );
  return row === undefined
    ? undefined
    : ({
        ...row,
        currentPeriodEnd: row.currentPeriodEnd ?? undefined,
      } satisfies SubscriptionRecord);
});

const memberOfCustomer = Effect.fn("memberOfCustomer")(function* memberOfCustomer(
  stripeCustomerId: string,
) {
  const [row] = yield* query((database) =>
    database
      .select({ memberId: planSubscription.memberId })
      .from(planSubscription)
      .where(eq(planSubscription.stripeCustomerId, stripeCustomerId))
      .limit(1),
  );
  return row?.memberId;
});

function entitles(subscription: SubscriptionRecord | undefined, now: Date): boolean {
  return (
    subscription !== undefined &&
    paidStatuses.includes(subscription.status) &&
    (subscription.currentPeriodEnd === undefined || subscription.currentPeriodEnd > now)
  );
}

const planOf = Effect.fn("planOf")(function* planOf(memberId: string) {
  const subscription = yield* findSubscription(memberId);
  const now = yield* clockDate;
  const view: PlanView = {
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
    currentPeriodEnd: subscription?.currentPeriodEnd,
    plan: entitles(subscription, now) ? PLAN.paid : PLAN.free,
    status: subscription?.status,
  };
  return view;
});

const isPaidMember = Effect.fn("isPaidMember")(function* isPaidMember(memberId: string) {
  return (yield* planOf(memberId)).plan === PLAN.paid;
});

const requirePaid = Effect.fn("requirePaid")(function* requirePaid(memberId: string) {
  if (!(yield* isPaidMember(memberId))) {
    return yield* new PaidPlanRequired();
  }
});

const applyStripeEvent = Effect.fn("applyStripeEvent")(function* applyStripeEvent(
  event: StripeEventRecord,
  write: (database: DrizzleDatabase) => BatchItem<"sqlite">,
) {
  const [seen] = yield* query((database) =>
    database
      .select({ id: stripeEvent.id })
      .from(stripeEvent)
      .where(eq(stripeEvent.id, event.id))
      .limit(1),
  );
  if (seen !== undefined) {
    return WEBHOOK_OUTCOME.duplicate;
  }
  const receivedAt = yield* clockDate;
  yield* query((database) =>
    database.batch([
      database.insert(stripeEvent).values({ id: event.id, receivedAt, type: event.type }),
      write(database),
    ]),
  );
  return WEBHOOK_OUTCOME.applied;
});

function subscriptionValues(
  record: SubscriptionRecord,
  updatedAt: Date,
): typeof planSubscription.$inferInsert {
  return {
    cancelAtPeriodEnd: record.cancelAtPeriodEnd,
    currentPeriodEnd: record.currentPeriodEnd === undefined ? null : record.currentPeriodEnd,
    memberId: record.memberId,
    status: record.status,
    stripeCustomerId: record.stripeCustomerId,
    stripeSubscriptionId: record.stripeSubscriptionId,
    updatedAt,
  };
}

const recordSubscription = Effect.fn("recordSubscription")(function* recordSubscription(
  event: StripeEventRecord,
  record: SubscriptionRecord,
) {
  const values = subscriptionValues(record, event.createdAt);
  return yield* applyStripeEvent(event, (database) =>
    database
      .insert(planSubscription)
      .values(values)
      .onConflictDoUpdate({
        set: values,
        setWhere: lte(planSubscription.updatedAt, event.createdAt),
        target: planSubscription.memberId,
      }),
  );
});

const attachCheckout = Effect.fn("attachCheckout")(function* attachCheckout(
  event: StripeEventRecord,
  record: SubscriptionRecord,
) {
  return yield* applyStripeEvent(event, (database) =>
    database
      .insert(planSubscription)
      .values(subscriptionValues(record, event.createdAt))
      .onConflictDoNothing(),
  );
});

const markPaymentFailed = Effect.fn("markPaymentFailed")(function* markPaymentFailed(
  event: StripeEventRecord,
  stripeSubscriptionId: string,
) {
  return yield* applyStripeEvent(event, (database) =>
    database
      .update(planSubscription)
      .set({ status: SUBSCRIPTION_STATUS.pastDue, updatedAt: event.createdAt })
      .where(
        and(
          eq(planSubscription.stripeSubscriptionId, stripeSubscriptionId),
          lte(planSubscription.updatedAt, event.createdAt),
        ),
      ),
  );
});

export {
  attachCheckout,
  findSubscription,
  isPaidMember,
  markPaymentFailed,
  memberOfCustomer,
  planOf,
  recordSubscription,
  requirePaid,
};
export type { StripeEventRecord, SubscriptionRecord };
