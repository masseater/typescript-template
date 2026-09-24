import { SUBSCRIPTION_STATUS } from "@repo/config";
import { DateTime, Effect, Layer } from "effect";
import { TestClock } from "effect/testing";
import { describe, expect, test } from "vite-plus/test";

import { stripeEvent } from "./billing-schema.ts";
import {
  attachCheckout,
  findSubscription,
  isPaidMember,
  markPaymentFailed,
  memberOfCustomer,
  planOf,
  recordSubscription,
  requirePaid,
  type StripeEventRecord,
  type SubscriptionRecord,
} from "./billing.ts";
import { query } from "./database.ts";
import { addUser } from "./records-test-fixture.ts";
import { TestDatabase } from "./database-test-fixture.ts";

const monthLater = DateTime.toDate(DateTime.makeUnsafe("2026-10-20T00:00:00.000Z"));

const aliceSubscription: SubscriptionRecord = {
  cancelAtPeriodEnd: false,
  currentPeriodEnd: monthLater,
  memberId: "alice",
  status: SUBSCRIPTION_STATUS.active,
  stripeCustomerId: "cus_alice",
  stripeSubscriptionId: "sub_alice",
};

const firstUpdate: StripeEventRecord = {
  createdAt: DateTime.toDate(DateTime.makeUnsafe("2026-09-20T00:00:00.000Z")),
  id: "evt_1",
  type: "customer.subscription.updated",
};

const laterDeletion: StripeEventRecord = {
  createdAt: DateTime.toDate(DateTime.makeUnsafe("2026-09-21T00:00:00.000Z")),
  id: "evt_2",
  type: "customer.subscription.deleted",
};

describe("a member without a subscription", () => {
  const it = test.extend("freeAccess", () =>
    Effect.runPromise(
      Effect.gen(function* withoutSubscription() {
        yield* addUser({ userId: "alice" });
        const plan = yield* planOf("alice");
        const paid = yield* isPaidMember("alice");
        const refused = yield* requirePaid("alice").pipe(Effect.flip);
        return { paid, plan, refusedTag: refused._tag };
      }).pipe(Effect.provide(Layer.merge(TestDatabase, TestClock.layer()))),
    ));

  it("is free and is refused paid features", ({ freeAccess }) => {
    expect(freeAccess).toStrictEqual({
      paid: false,
      plan: {
        cancelAtPeriodEnd: false,
        currentPeriodEnd: undefined,
        plan: "free",
        status: undefined,
      },
      refusedTag: "PaidPlanRequired",
    });
  });
});

describe("an active subscription inside its period", () => {
  const it = test.extend("paidAccess", () =>
    Effect.runPromise(
      Effect.gen(function* activeSubscription() {
        yield* addUser({ userId: "alice" });
        yield* TestClock.setTime(
          DateTime.toEpochMillis(DateTime.makeUnsafe("2026-09-20T00:00:00.000Z")),
        );
        const disposition = yield* recordSubscription(firstUpdate, aliceSubscription);
        const plan = yield* planOf("alice");
        yield* requirePaid("alice");
        const customerMember = yield* memberOfCustomer("cus_alice");
        return { customerMember, disposition, plan };
      }).pipe(Effect.provide(Layer.merge(TestDatabase, TestClock.layer()))),
    ));

  it("makes the member paid", ({ paidAccess }) => {
    expect(paidAccess).toStrictEqual({
      customerMember: "alice",
      disposition: "applied",
      plan: {
        cancelAtPeriodEnd: false,
        currentPeriodEnd: monthLater,
        plan: "paid",
        status: "active",
      },
    });
  });
});

describe("a subscription past its period end", () => {
  const it = test.extend("entitlementAroundPeriodEnd", () =>
    Effect.runPromise(
      Effect.gen(function* pastPeriodEnd() {
        yield* addUser({ userId: "alice" });
        yield* recordSubscription(firstUpdate, aliceSubscription);
        yield* TestClock.setTime(monthLater.getTime());
        const atPeriodEnd = yield* isPaidMember("alice");
        yield* TestClock.setTime(monthLater.getTime() - 1);
        const beforePeriodEnd = yield* isPaidMember("alice");
        return { atPeriodEnd, beforePeriodEnd };
      }).pipe(Effect.provide(Layer.merge(TestDatabase, TestClock.layer()))),
    ));

  it("no longer entitles the member", ({ entitlementAroundPeriodEnd }) => {
    expect(entitlementAroundPeriodEnd).toStrictEqual({
      atPeriodEnd: false,
      beforePeriodEnd: true,
    });
  });
});

describe.for([
  SUBSCRIPTION_STATUS.canceled,
  SUBSCRIPTION_STATUS.incomplete,
  SUBSCRIPTION_STATUS.incompleteExpired,
  SUBSCRIPTION_STATUS.pastDue,
  SUBSCRIPTION_STATUS.paused,
  SUBSCRIPTION_STATUS.unpaid,
])("a subscription in the %s state", (subscriptionStatus) => {
  const it = test.extend("unpaidPlan", () =>
    Effect.runPromise(
      Effect.gen(function* unpaidSubscription() {
        yield* addUser({ userId: "alice" });
        yield* recordSubscription(firstUpdate, {
          ...aliceSubscription,
          status: subscriptionStatus,
        });
        const plan = yield* planOf("alice");
        return { plan: plan.plan, subscriptionStatus: plan.status };
      }).pipe(Effect.provide(Layer.merge(TestDatabase, TestClock.layer()))),
    ));

  it("is free", ({ unpaidPlan }) => {
    expect(unpaidPlan).toStrictEqual({ plan: "free", subscriptionStatus });
  });
});

describe("a trialing subscription", () => {
  const it = test.extend("trialingPaid", () =>
    Effect.runPromise(
      Effect.gen(function* trialingSubscription() {
        yield* addUser({ userId: "alice" });
        yield* recordSubscription(firstUpdate, {
          ...aliceSubscription,
          status: SUBSCRIPTION_STATUS.trialing,
        });
        return yield* isPaidMember("alice");
      }).pipe(Effect.provide(Layer.merge(TestDatabase, TestClock.layer()))),
    ));

  it("entitles the member", ({ trialingPaid }) => {
    expect(trialingPaid).toBe(true);
  });
});

describe("the same event applied twice", () => {
  const it = test.extend("replayedEvent", () =>
    Effect.runPromise(
      Effect.gen(function* replay() {
        yield* addUser({ userId: "alice" });
        yield* recordSubscription(firstUpdate, aliceSubscription);
        const cancelled = yield* recordSubscription(laterDeletion, {
          ...aliceSubscription,
          status: SUBSCRIPTION_STATUS.canceled,
        });
        const replayed = yield* recordSubscription(firstUpdate, aliceSubscription);
        const stored = yield* findSubscription("alice");
        const storedEvents = yield* query((database) =>
          database.select({ id: stripeEvent.id }).from(stripeEvent).orderBy(stripeEvent.id),
        );
        return {
          cancelled,
          replayed,
          storedEventCount: storedEvents.length,
          storedStatus: stored?.status,
        };
      }).pipe(Effect.provide(Layer.merge(TestDatabase, TestClock.layer()))),
    ));

  it("leaves the subscription and the event log unchanged", ({ replayedEvent }) => {
    expect(replayedEvent).toStrictEqual({
      cancelled: "applied",
      replayed: "duplicate",
      storedEventCount: 2,
      storedStatus: "canceled",
    });
  });
});

describe("an older event that arrives late", () => {
  const it = test.extend("lateEvent", () =>
    Effect.runPromise(
      Effect.gen(function* arriveLate() {
        yield* addUser({ userId: "alice" });
        yield* recordSubscription(laterDeletion, {
          ...aliceSubscription,
          status: SUBSCRIPTION_STATUS.canceled,
        });
        const late = yield* recordSubscription(firstUpdate, aliceSubscription);
        const stored = yield* findSubscription("alice");
        const storedEvents = yield* query((database) =>
          database.select({ id: stripeEvent.id }).from(stripeEvent).orderBy(stripeEvent.id),
        );
        return { late, storedEventCount: storedEvents.length, storedStatus: stored?.status };
      }).pipe(Effect.provide(Layer.merge(TestDatabase, TestClock.layer()))),
    ));

  it("cannot revert a newer subscription state", ({ lateEvent }) => {
    expect(lateEvent).toStrictEqual({
      late: "applied",
      storedEventCount: 2,
      storedStatus: "canceled",
    });
  });
});

describe("a completed checkout", () => {
  const it = test.extend("checkoutAttachment", () =>
    Effect.runPromise(
      Effect.gen(function* completeCheckout() {
        yield* addUser({ userId: "alice" });
        const attached = yield* attachCheckout(
          {
            createdAt: DateTime.toDate(DateTime.makeUnsafe("2026-09-20T00:00:00.000Z")),
            id: "evt_checkout",
            type: "checkout.session.completed",
          },
          { ...aliceSubscription, currentPeriodEnd: undefined },
        );
        const afterCheckout = yield* findSubscription("alice");
        const paidAfterCheckout = yield* isPaidMember("alice");
        yield* recordSubscription(
          {
            createdAt: DateTime.toDate(DateTime.makeUnsafe("2026-09-20T00:00:01.000Z")),
            id: "evt_sub",
            type: "customer.subscription.updated",
          },
          { ...aliceSubscription, cancelAtPeriodEnd: true },
        );
        const attachedAgain = yield* attachCheckout(
          {
            createdAt: DateTime.toDate(DateTime.makeUnsafe("2026-09-20T00:00:02.000Z")),
            id: "evt_checkout_2",
            type: "checkout.session.completed",
          },
          { ...aliceSubscription, currentPeriodEnd: undefined },
        );
        const afterSubscriptionEvent = yield* findSubscription("alice");
        return {
          afterCheckout,
          afterSubscriptionEvent,
          attached,
          attachedAgain,
          paidAfterCheckout,
        };
      }).pipe(Effect.provide(Layer.merge(TestDatabase, TestClock.layer()))),
    ));

  it("attaches the customer only until a subscription event knows more", ({
    checkoutAttachment,
  }) => {
    expect(checkoutAttachment).toStrictEqual({
      afterCheckout: {
        cancelAtPeriodEnd: false,
        currentPeriodEnd: undefined,
        memberId: "alice",
        status: "active",
        stripeCustomerId: "cus_alice",
        stripeSubscriptionId: "sub_alice",
      },
      afterSubscriptionEvent: {
        cancelAtPeriodEnd: true,
        currentPeriodEnd: monthLater,
        memberId: "alice",
        status: "active",
        stripeCustomerId: "cus_alice",
        stripeSubscriptionId: "sub_alice",
      },
      attached: "applied",
      attachedAgain: "applied",
      paidAfterCheckout: true,
    });
  });
});

describe("a failed payment", () => {
  const it = test.extend("failedPayment", () =>
    Effect.runPromise(
      Effect.gen(function* failPayment() {
        yield* addUser({ userId: "alice" });
        yield* recordSubscription(firstUpdate, aliceSubscription);
        const failed = yield* markPaymentFailed(
          {
            createdAt: DateTime.toDate(DateTime.makeUnsafe("2026-09-21T00:00:00.000Z")),
            id: "evt_2",
            type: "invoice.payment_failed",
          },
          "sub_alice",
        );
        const stored = yield* findSubscription("alice");
        const paid = yield* isPaidMember("alice");
        return { failed, paid, storedStatus: stored?.status };
      }).pipe(Effect.provide(Layer.merge(TestDatabase, TestClock.layer()))),
    ));

  it("moves the subscription to past_due and the member back to free", ({ failedPayment }) => {
    expect(failedPayment).toStrictEqual({
      failed: "applied",
      paid: false,
      storedStatus: "past_due",
    });
  });
});
