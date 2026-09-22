import {
  SessionIdentity,
  type BillingPlanView,
  type MemberSubscriptionView,
  type StripeEventPayload,
  type WebhookOutcomeView,
} from "@repo/core-api";
import {
  type PaidPlanRequired,
  type StripeEventUnreadable,
  applyStripeWebhookEvent,
  findSubscription,
  planOf,
  requirePaid,
  type Database,
  type DatabaseFailure,
} from "@repo/db";
import { Effect } from "effect";

const dieDatabase = {
  DatabaseFailure: (failure: DatabaseFailure) => Effect.die(failure),
} as const;


const subscriptionViewOf = (
  memberId: string,
): Effect.Effect<typeof MemberSubscriptionView.Type | null, never, Database> =>
  Effect.gen(function* subscriptionViewOfProgram() {
    const subscription = yield* findSubscription(memberId).pipe(Effect.catchTags(dieDatabase));
    if (subscription === undefined) {
      return null;
    }
    return {
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      ...(subscription.currentPeriodEnd === undefined
        ? {}
        : { currentPeriodEnd: subscription.currentPeriodEnd.getTime() }),
      memberId: subscription.memberId,
      status: subscription.status,
      stripeCustomerId: subscription.stripeCustomerId,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
    };
  });

const planViewOf = (
  memberId: string,
): Effect.Effect<typeof BillingPlanView.Type, never, Database> =>
  Effect.gen(function* planViewOfProgram() {
    const plan = yield* planOf(memberId).pipe(Effect.catchTags(dieDatabase));
    return {
      cancelAtPeriodEnd: plan.cancelAtPeriodEnd,
      ...(plan.currentPeriodEnd === undefined
        ? {}
        : { currentPeriodEnd: plan.currentPeriodEnd.getTime() }),
      plan: plan.plan,
      ...(plan.status === undefined ? {} : { status: plan.status }),
    };
  });

const getBillingPlan = (): Effect.Effect<
  typeof BillingPlanView.Type,
  never,
  SessionIdentity | Database
> =>
  Effect.gen(function* getBillingPlanProgram() {
    const identity = yield* SessionIdentity;
    return yield* planViewOf(identity.user.id);
  });

const getMemberSubscription = (): Effect.Effect<
  typeof MemberSubscriptionView.Type | null,
  never,
  SessionIdentity | Database
> =>
  Effect.gen(function* getMemberSubscriptionProgram() {
    const identity = yield* SessionIdentity;
    return yield* subscriptionViewOf(identity.user.id);
  });

const requirePaidMembership = (): Effect.Effect<
  void,
  PaidPlanRequired,
  SessionIdentity | Database
> =>
  Effect.gen(function* requirePaidMembershipProgram() {
    const identity = yield* SessionIdentity;
    yield* requirePaid(identity.user.id).pipe(Effect.catchTags(dieDatabase));
  });

const applyStripeEvent = (
  event: typeof StripeEventPayload.Type,
): Effect.Effect<typeof WebhookOutcomeView.Type, StripeEventUnreadable, Database> =>
  applyStripeWebhookEvent(event).pipe(
    Effect.map((outcome) => ({ outcome })),
    Effect.catchTags(dieDatabase),
  );

export { applyStripeEvent, getBillingPlan, getMemberSubscription, requirePaidMembership };
