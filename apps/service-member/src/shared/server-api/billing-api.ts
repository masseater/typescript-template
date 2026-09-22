import { verifySession } from "@repo/auth";
import { PLAN, httpStatus } from "@repo/config";
import { PaidPlanRequired, findSubscription, planOf } from "@repo/db";
import { sessionFailures } from "@repo/runtime/account";
import { AppOrigin, createApi, readJsonBody } from "@repo/runtime/http";
import { Effect, Schema } from "effect";

import { PaidAlready, Stripe, handleStripeEvent, paidFailures } from "#shared/billing/index.ts";
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
const plan = Effect.fn("billing.api.plan")(function* plan(request: Request) {
  const { user } = yield* verifySession(request.headers);
  return yield* planOf(user.id);
});
const offer = Effect.fn("billing.api.offer")(function* offer(request: Request) {
  yield* verifySession(request.headers);
  return yield* (yield* Stripe).offer;
});
const checkout = Effect.fn("billing.api.checkout")(function* checkout(request: Request) {
  const { user } = yield* verifySession(request.headers);
  yield* readJsonBody(Empty, request);
  if ((yield* planOf(user.id)).plan === PLAN.paid) {
    return yield* new PaidAlready();
  }
  const origin = yield* AppOrigin;
  const subscription = yield* findSubscription(user.id);
  const url = yield* (yield* Stripe).createCheckoutSession({
    cancelUrl: `${origin}/upgrade?checkout=${CHECKOUT_RETURN.cancel}`,
    customer:
      subscription === undefined
        ? {
            email: user.email,
          }
        : {
            id: subscription.stripeCustomerId,
          },
    memberId: user.id,
    successUrl: `${origin}/settings/plan?checkout=${CHECKOUT_RETURN.success}`,
  });
  return {
    url,
  };
});
const portal = Effect.fn("billing.api.portal")(function* portal(request: Request) {
  const { user } = yield* verifySession(request.headers);
  yield* readJsonBody(Empty, request);
  const subscription = yield* findSubscription(user.id);
  if (subscription === undefined) {
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
  return {
    outcome: yield* handleStripeEvent(event),
  };
});
function billingApi(api: ApiRoutes<AppServices | Stripe>) {
  return createApi("")
    .get("/billing/plan", api.route(PlanView, plan, failures))
    .get("/billing/offer", api.route(OfferView, offer, failures))
    .post("/billing/checkout", api.route(HostedPage, checkout, failures))
    .post("/billing/portal", api.route(HostedPage, portal, failures))
    .post("/billing/webhook", api.route(WebhookReceipt, webhook, failures));
}
export { billingApi };
