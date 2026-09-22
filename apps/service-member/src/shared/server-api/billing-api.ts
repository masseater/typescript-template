import { PLAN, httpStatus, subscriptionStatuses, type SubscriptionStatus } from "@repo/config";
import { PaidPlanRequired } from "@repo/db";
import {
  applyStripeEvent,
  getBillingPlan,
  getMemberSubscription,
  readSession,
  sessionFailures,
} from "@repo/runtime/account";
import { AppOrigin, createApi, readJsonBody } from "@repo/runtime/http";
import { DateTime, Effect, Schema } from "effect";

import { PaidAlready, Stripe, paidFailures } from "#shared/billing/index.ts";
import {
  CHECKOUT_RETURN,
  HostedPage,
  OfferView,
  PlanView,
  WebhookReceipt,
} from "#shared/contracts/index.ts";

import type { AppServices } from "@repo/runtime";
import type { ApiRoutes } from "@repo/runtime/http";

const Empty = Schema.Struct({});
const unreadable = {
  message: "通知を読み取れませんでした。",
  status: httpStatus.badRequest,
};
const failures = {
  ...sessionFailures,
  ...paidFailures,
  PaidAlready: {
    message: "すでに有料プランを契約しています。",
    status: httpStatus.conflict,
  },
  StripeEventUnreadable: unreadable,
  StripeFailure: "unexpected",
  StripeSignatureInvalid: unreadable,
} as const;

const asSubscriptionStatus = (status: string | undefined): SubscriptionStatus | undefined =>
  subscriptionStatuses.find((candidate) => candidate === status);

const planToContract = (plan: {
  readonly cancelAtPeriodEnd: boolean;
  readonly currentPeriodEnd?: number | undefined;
  readonly plan: typeof PLAN.free | typeof PLAN.paid;
  readonly status?: string | undefined;
}): typeof PlanView.Type => {
  const status = asSubscriptionStatus(plan.status);
  return {
    cancelAtPeriodEnd: plan.cancelAtPeriodEnd,
    ...(plan.currentPeriodEnd === undefined
      ? {}
      : { currentPeriodEnd: DateTime.toDate(DateTime.makeUnsafe(plan.currentPeriodEnd)) }),
    plan: plan.plan,
    ...(status === undefined ? {} : { status }),
  };
};

const plan = Effect.fn("billing.api.plan")(function* plan(request: Request) {
  return planToContract(yield* getBillingPlan(request));
});

const offer = Effect.fn("billing.api.offer")(function* offer(request: Request) {
  yield* readSession(request);
  return yield* (yield* Stripe).offer;
});

const checkout = Effect.fn("billing.api.checkout")(function* checkout(request: Request) {
  const session = yield* readSession(request);
  yield* readJsonBody(Empty, request);
  const planView = yield* getBillingPlan(request);
  if (planView.plan === PLAN.paid) {
    return yield* new PaidAlready();
  }
  const origin = yield* AppOrigin;
  const subscription = yield* getMemberSubscription(request);
  const url = yield* (yield* Stripe).createCheckoutSession({
    cancelUrl: `${origin}/upgrade?checkout=${CHECKOUT_RETURN.cancel}`,
    customer:
      subscription === null
        ? {
            email: session.user.email,
          }
        : {
            id: subscription.stripeCustomerId,
          },
    memberId: session.user.id,
    successUrl: `${origin}/settings/plan?checkout=${CHECKOUT_RETURN.success}`,
  });
  return {
    url,
  };
});

const portal = Effect.fn("billing.api.portal")(function* portal(request: Request) {
  yield* readSession(request);
  yield* readJsonBody(Empty, request);
  const subscription = yield* getMemberSubscription(request);
  if (subscription === null) {
    return yield* new PaidPlanRequired();
  }
  const origin = yield* AppOrigin;
  const url = yield* (yield* Stripe).createPortalSession({
    customerId: subscription.stripeCustomerId,
    returnUrl: `${origin}/settings/plan`,
  });
  return {
    url,
  };
});

const webhook = Effect.fn("billing.api.webhook")(function* webhook(request: Request) {
  const payload = yield* Effect.promise(() => request.text());
  const event = yield* (yield* Stripe).readEvent(payload, request.headers.get("stripe-signature"));
  return yield* applyStripeEvent(event);
});

function billingApi(api: ApiRoutes<AppServices | Stripe>) {
  return createApi("")
    .get("/billing/plan", ...api.route({ response: PlanView }, plan, failures))
    .get("/billing/offer", ...api.route({ response: OfferView }, offer, failures))
    .post("/billing/checkout", ...api.route({ response: HostedPage }, checkout, failures))
    .post("/billing/portal", ...api.route({ response: HostedPage }, portal, failures))
    .post("/billing/webhook", ...api.route({ response: WebhookReceipt }, webhook, failures));
}

export { billingApi };
