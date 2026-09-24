import {
  PLAN,
  SUBSCRIPTION_STATUS,
  WEBHOOK_DISPOSITION,
  paidStatuses,
  recoverableStatuses,
  type Plan,
  type SubscriptionStatus,
} from "@repo/config";
import { and, eq, inArray, lte } from "drizzle-orm";
import { Effect } from "effect";

import { planSubscription, stripeEvent } from "./billing-schema.ts";
import { clockDate } from "./clock-date.ts";
import { query, type DrizzleDatabase } from "./database.ts";
import { PaidPlanRequired } from "./paid-plan-required.ts";

import type { BatchItem } from "drizzle-orm/batch";

type StripeEventRecord = Readonly<{
  createdAt: Date;
  id: string;
  type: string;
}>;

type SubscriptionRecord = Readonly<{
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | undefined;
  memberId: string;
  status: SubscriptionStatus;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
}>;

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
  const [subscriptionRow] = yield* query((database) =>
    database
      .select(subscriptionColumns)
      .from(planSubscription)
      .where(eq(planSubscription.memberId, memberId))
      .limit(1),
  );
  return subscriptionRow === undefined
    ? undefined
    : ({
        ...subscriptionRow,
        currentPeriodEnd: subscriptionRow.currentPeriodEnd ?? undefined,
      } satisfies SubscriptionRecord);
});

const memberOfCustomer = Effect.fn("memberOfCustomer")(function* memberOfCustomer(
  stripeCustomerId: string,
) {
  const [customerSubscription] = yield* query((database) =>
    database
      .select({ memberId: planSubscription.memberId })
      .from(planSubscription)
      .where(eq(planSubscription.stripeCustomerId, stripeCustomerId))
      .limit(1),
  );
  return customerSubscription?.memberId;
});

const entitles = (subscription: SubscriptionRecord | undefined, checkedAt: Date): boolean =>
  subscription !== undefined &&
  paidStatuses.includes(subscription.status) &&
  (subscription.currentPeriodEnd === undefined || subscription.currentPeriodEnd > checkedAt);

const planOf = Effect.fn("planOf")(function* planOf(memberId: string) {
  const subscription = yield* findSubscription(memberId);
  const checkedAt = yield* clockDate;
  const view: Readonly<{
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: Date | undefined;
    plan: Plan;
    status: SubscriptionStatus | undefined;
  }> = {
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
    currentPeriodEnd: subscription?.currentPeriodEnd,
    plan: entitles(subscription, checkedAt) ? PLAN.paid : PLAN.free,
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
  webhookEvent: StripeEventRecord,
  write: (database: DrizzleDatabase) => BatchItem<"sqlite">,
) {
  const [seen] = yield* query((database) =>
    database
      .select({ id: stripeEvent.id })
      .from(stripeEvent)
      .where(eq(stripeEvent.id, webhookEvent.id))
      .limit(1),
  );
  if (seen !== undefined) {
    return WEBHOOK_DISPOSITION.duplicate;
  }
  const receivedAt = yield* clockDate;
  yield* query((database) =>
    database.batch([
      database
        .insert(stripeEvent)
        .values({ id: webhookEvent.id, receivedAt, type: webhookEvent.type }),
      write(database),
    ]),
  );
  return WEBHOOK_DISPOSITION.applied;
});

const subscriptionValues = (
  subscription: SubscriptionRecord,
  updatedAt: Date,
): typeof planSubscription.$inferInsert => ({
  cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
  currentPeriodEnd: subscription.currentPeriodEnd ?? null,
  memberId: subscription.memberId,
  status: subscription.status,
  stripeCustomerId: subscription.stripeCustomerId,
  stripeSubscriptionId: subscription.stripeSubscriptionId,
  updatedAt,
});

const recordSubscription = Effect.fn("recordSubscription")(function* recordSubscription(
  webhookEvent: StripeEventRecord,
  subscription: SubscriptionRecord,
) {
  const subscriptionUpsert = subscriptionValues(subscription, webhookEvent.createdAt);
  return yield* applyStripeEvent(webhookEvent, (database) =>
    database
      .insert(planSubscription)
      .values(subscriptionUpsert)
      .onConflictDoUpdate({
        set: subscriptionUpsert,
        setWhere: lte(planSubscription.updatedAt, webhookEvent.createdAt),
        target: planSubscription.memberId,
      }),
  );
});

const attachCheckout = Effect.fn("attachCheckout")(function* attachCheckout(
  webhookEvent: StripeEventRecord,
  subscription: SubscriptionRecord,
) {
  return yield* applyStripeEvent(webhookEvent, (database) =>
    database
      .insert(planSubscription)
      .values(subscriptionValues(subscription, webhookEvent.createdAt))
      .onConflictDoNothing(),
  );
});

const markPaymentFailed = Effect.fn("markPaymentFailed")(function* markPaymentFailed(
  webhookEvent: StripeEventRecord,
  stripeSubscriptionId: string,
) {
  return yield* applyStripeEvent(webhookEvent, (database) =>
    database
      .update(planSubscription)
      .set({ status: SUBSCRIPTION_STATUS.pastDue, updatedAt: webhookEvent.createdAt })
      .where(
        and(
          eq(planSubscription.stripeSubscriptionId, stripeSubscriptionId),
          lte(planSubscription.updatedAt, webhookEvent.createdAt),
        ),
      ),
  );
});

const markPaymentSettled = Effect.fn("markPaymentSettled")(function* markPaymentSettled(
  webhookEvent: StripeEventRecord,
  stripeSubscriptionId: string,
) {
  return yield* applyStripeEvent(webhookEvent, (database) =>
    database
      .update(planSubscription)
      .set({ status: SUBSCRIPTION_STATUS.active, updatedAt: webhookEvent.createdAt })
      .where(
        and(
          eq(planSubscription.stripeSubscriptionId, stripeSubscriptionId),
          lte(planSubscription.updatedAt, webhookEvent.createdAt),
          inArray(planSubscription.status, recoverableStatuses),
        ),
      ),
  );
});

export {
  attachCheckout,
  findSubscription,
  isPaidMember,
  markPaymentFailed,
  markPaymentSettled,
  memberOfCustomer,
  planOf,
  recordSubscription,
  requirePaid,
};
export type { StripeEventRecord, SubscriptionRecord };
