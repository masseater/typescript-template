import { assert, it } from "@effect/vitest";
import { SUBSCRIPTION_STATUS } from "@repo/config";
import { DateTime, Effect, Layer } from "effect";
import { TestClock } from "effect/testing";

import {
  attachCheckout,
  findSubscription,
  isPaidMember,
  markPaymentFailed,
  memberOfCustomer,
  planOf,
  recordSubscription,
  requirePaid,
} from "./billing.ts";
import { TestDatabase, runStatement } from "./testing.ts";

const services = Layer.merge(TestDatabase, TestClock.layer());

function addMember(id: string): Effect.Effect<unknown, unknown> {
  return runStatement(
    "INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 1, 0, 0)",
    id,
    id,
    `${id}@example.com`,
  );
}

const countEvents = Effect.map(
  runStatement("SELECT count(*) AS count FROM stripe_event"),
  (result) => {
    const row = result.results[0];
    if (typeof row !== "object" || row === null || !("count" in row)) {
      return undefined;
    }
    return row.count;
  },
);

const monthLater = DateTime.toDate(DateTime.makeUnsafe("2026-10-20T00:00:00.000Z"));

function active(
  memberId: string,
  overrides: Partial<Parameters<typeof recordSubscription>[1]> = {},
) {
  return {
    cancelAtPeriodEnd: false,
    currentPeriodEnd: monthLater,
    memberId,
    status: SUBSCRIPTION_STATUS.active,
    stripeCustomerId: `cus_${memberId}`,
    stripeSubscriptionId: `sub_${memberId}`,
    ...overrides,
  };
}

function event(id: string, createdAt: string, type = "customer.subscription.updated") {
  return { createdAt: DateTime.toDate(DateTime.makeUnsafe(createdAt)), id, type };
}

it.effect("a member without a subscription is free and is refused paid features", () =>
  Effect.gen(function* program() {
    yield* addMember("alice");
    assert.deepStrictEqual(yield* planOf("alice"), {
      cancelAtPeriodEnd: false,
      currentPeriodEnd: undefined,
      plan: "free",
      status: undefined,
    });
    assert.isFalse(yield* isPaidMember("alice"));
    const refused = yield* requirePaid("alice").pipe(Effect.flip);
    assert.strictEqual(refused._tag, "PaidPlanRequired");
  }).pipe(Effect.provide(services)),
);

it.effect("an active subscription inside its period makes the member paid", () =>
  Effect.gen(function* program() {
    yield* addMember("alice");
    yield* TestClock.setTime(DateTime.toEpochMillis(DateTime.makeUnsafe("2026-09-20T00:00:00.000Z")));
    const outcome = yield* recordSubscription(
      event("evt_1", "2026-09-20T00:00:00.000Z"),
      active("alice"),
    );
    assert.strictEqual(outcome, "applied");
    assert.deepStrictEqual(yield* planOf("alice"), {
      cancelAtPeriodEnd: false,
      currentPeriodEnd: monthLater,
      plan: "paid",
      status: "active",
    });
    yield* requirePaid("alice");
    assert.strictEqual(yield* memberOfCustomer("cus_alice"), "alice");
  }).pipe(Effect.provide(services)),
);

it.effect("a subscription past its period end no longer entitles the member", () =>
  Effect.gen(function* program() {
    yield* addMember("alice");
    yield* recordSubscription(event("evt_1", "2026-09-20T00:00:00.000Z"), active("alice"));
    yield* TestClock.setTime(monthLater.getTime());
    assert.isFalse(yield* isPaidMember("alice"));
    yield* TestClock.setTime(monthLater.getTime() - 1);
    assert.isTrue(yield* isPaidMember("alice"));
  }).pipe(Effect.provide(services)),
);

it.effect.each([
  SUBSCRIPTION_STATUS.canceled,
  SUBSCRIPTION_STATUS.incomplete,
  SUBSCRIPTION_STATUS.incompleteExpired,
  SUBSCRIPTION_STATUS.pastDue,
  SUBSCRIPTION_STATUS.paused,
  SUBSCRIPTION_STATUS.unpaid,
])("a subscription in the %s state is free", (status) =>
  Effect.gen(function* program() {
    yield* addMember("alice");
    yield* recordSubscription(
      event("evt_1", "2026-09-20T00:00:00.000Z"),
      active("alice", { status }),
    );
    assert.strictEqual((yield* planOf("alice")).plan, "free");
    assert.strictEqual((yield* planOf("alice")).status, status);
  }).pipe(Effect.provide(services)),
);

it.effect("a trialing subscription entitles the member", () =>
  Effect.gen(function* program() {
    yield* addMember("alice");
    yield* recordSubscription(
      event("evt_1", "2026-09-20T00:00:00.000Z"),
      active("alice", { status: SUBSCRIPTION_STATUS.trialing }),
    );
    assert.isTrue(yield* isPaidMember("alice"));
  }).pipe(Effect.provide(services)),
);

it.effect("the same event applied twice leaves the subscription and the event log unchanged", () =>
  Effect.gen(function* program() {
    yield* addMember("alice");
    const first = event("evt_1", "2026-09-20T00:00:00.000Z");
    yield* recordSubscription(first, active("alice"));
    const cancelled = yield* recordSubscription(
      event("evt_2", "2026-09-21T00:00:00.000Z", "customer.subscription.deleted"),
      active("alice", { status: SUBSCRIPTION_STATUS.canceled }),
    );
    assert.strictEqual(cancelled, "applied");
    const replayed = yield* recordSubscription(first, active("alice"));
    assert.strictEqual(replayed, "duplicate");
    assert.strictEqual((yield* findSubscription("alice"))?.status, "canceled");
    assert.strictEqual(yield* countEvents, 2);
  }).pipe(Effect.provide(services)),
);

it.effect("an older event that arrives late cannot revert a newer subscription state", () =>
  Effect.gen(function* program() {
    yield* addMember("alice");
    yield* recordSubscription(
      event("evt_2", "2026-09-21T00:00:00.000Z", "customer.subscription.deleted"),
      active("alice", { status: SUBSCRIPTION_STATUS.canceled }),
    );
    const late = yield* recordSubscription(
      event("evt_1", "2026-09-20T00:00:00.000Z"),
      active("alice"),
    );
    assert.strictEqual(late, "applied");
    assert.strictEqual((yield* findSubscription("alice"))?.status, "canceled");
    assert.strictEqual(yield* countEvents, 2);
  }).pipe(Effect.provide(services)),
);

it.effect(
  "a completed checkout attaches the customer only until a subscription event knows more",
  () =>
    Effect.gen(function* program() {
      yield* addMember("alice");
      const attached = yield* attachCheckout(
        event("evt_checkout", "2026-09-20T00:00:00.000Z", "checkout.session.completed"),
        active("alice", { currentPeriodEnd: undefined }),
      );
      assert.strictEqual(attached, "applied");
      assert.deepStrictEqual(yield* findSubscription("alice"), {
        cancelAtPeriodEnd: false,
        currentPeriodEnd: undefined,
        memberId: "alice",
        status: "active",
        stripeCustomerId: "cus_alice",
        stripeSubscriptionId: "sub_alice",
      });
      assert.isTrue(yield* isPaidMember("alice"));
      yield* recordSubscription(
        event("evt_sub", "2026-09-20T00:00:01.000Z"),
        active("alice", { cancelAtPeriodEnd: true }),
      );
      const again = yield* attachCheckout(
        event("evt_checkout_2", "2026-09-20T00:00:02.000Z", "checkout.session.completed"),
        active("alice", { currentPeriodEnd: undefined }),
      );
      assert.strictEqual(again, "applied");
      assert.deepStrictEqual(yield* findSubscription("alice"), {
        cancelAtPeriodEnd: true,
        currentPeriodEnd: monthLater,
        memberId: "alice",
        status: "active",
        stripeCustomerId: "cus_alice",
        stripeSubscriptionId: "sub_alice",
      });
    }).pipe(Effect.provide(services)),
);

it.effect("a failed payment moves the subscription to past_due and the member back to free", () =>
  Effect.gen(function* program() {
    yield* addMember("alice");
    yield* recordSubscription(event("evt_1", "2026-09-20T00:00:00.000Z"), active("alice"));
    const failed = yield* markPaymentFailed(
      event("evt_2", "2026-09-21T00:00:00.000Z", "invoice.payment_failed"),
      "sub_alice",
    );
    assert.strictEqual(failed, "applied");
    assert.strictEqual((yield* findSubscription("alice"))?.status, "past_due");
    assert.isFalse(yield* isPaidMember("alice"));
  }).pipe(Effect.provide(services)),
);
