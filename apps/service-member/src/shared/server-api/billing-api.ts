import { verifySession } from "@repo/auth";
import { PLAN, WEBHOOK_DISPOSITION, httpStatus } from "@repo/config";
import {
  PaidPlanRequired,
  aiUsageSince,
  findInvoiceOfOrigin,
  findSubscription,
  listMemberInvoices,
  listMemberQuotes,
  planOf,
  recordIssuedInvoice,
} from "@repo/db";
import { sessionFailures } from "@repo/runtime/account";
import { AppOrigin, createApi, readJsonBody } from "@repo/runtime/http";
import { DateTime, Effect, Schema } from "effect";

import { PaidAlready, Stripe, handleStripeEvent, paidFailures } from "#shared/billing/index.ts";
import {
  CHECKOUT_RETURN,
  HostedPage,
  InvoiceList,
  OfferView,
  PlanView,
  QuoteList,
  UsageView,
  WebhookReceipt,
} from "#shared/contracts/index.ts";

import type { AppServices } from "@repo/runtime";
import type { ApiRoutes } from "@repo/runtime/http";
const Empty = Schema.Struct({});
const invoiceDescription = "継続プラン";
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
const subscribedMember = Effect.fn("billing.api.subscribedMember")(function* subscribedMember(
  request: Request,
) {
  const { user } = yield* verifySession(request.headers);
  yield* readJsonBody(Empty, request);
  const subscription = yield* findSubscription(user.id);
  if (subscription === undefined) {
    return yield* new PaidPlanRequired();
  }
  return { subscription, user };
});
const portal = Effect.fn("billing.api.portal")(function* portal(request: Request) {
  const { subscription } = yield* subscribedMember(request);
  const origin = yield* AppOrigin;
  const url = yield* (yield* Stripe).createPortalSession({
    customerId: subscription.stripeCustomerId,
    returnUrl: `${origin}/settings/plan`,
  });
  return {
    url,
  };
});
const invoices = Effect.fn("billing.api.invoices")(function* invoices(request: Request) {
  const { user } = yield* verifySession(request.headers);
  const issued = yield* listMemberInvoices(user.id);
  return {
    invoices: issued.map((invoice) => ({
      amountCredited: invoice.amountCredited,
      amountDue: invoice.amountDue,
      amountPaid: invoice.amountPaid,
      amountRefunded: invoice.amountRefunded,
      amountRemaining: invoice.amountRemaining,
      currency: invoice.currency,
      issuedAt: invoice.issuedAt,
      status: invoice.status,
      stripeInvoiceId: invoice.stripeInvoiceId,
      ...(invoice.hostedInvoiceUrl === undefined
        ? {}
        : { hostedInvoiceUrl: invoice.hostedInvoiceUrl }),
    })),
  };
});

const payByInvoice = Effect.fn("billing.api.payByInvoice")(function* payByInvoice(
  request: Request,
) {
  const { subscription, user } = yield* subscribedMember(request);
  const stripe = yield* Stripe;
  yield* stripe.payByInvoice(subscription.stripeSubscriptionId);
  const originKey = `subscription-switch:${subscription.stripeSubscriptionId}`;
  const alreadyIssued = yield* findInvoiceOfOrigin(originKey);
  if (alreadyIssued !== undefined) {
    return { outcome: WEBHOOK_DISPOSITION.duplicate };
  }
  const offer = yield* stripe.offer;
  const issued = yield* stripe.createInvoice({
    amount: offer.unitAmount,
    currency: offer.currency,
    customerId: subscription.stripeCustomerId,
    description: invoiceDescription,
    memberId: user.id,
    originKey,
  });
  yield* recordIssuedInvoice({
    amountDue: issued.amountDue,
    amountRemaining: issued.amountRemaining,
    currency: issued.currency,
    memberId: user.id,
    originKey,
    status: issued.status,
    stripeInvoiceId: issued.stripeInvoiceId,
  });
  return { outcome: WEBHOOK_DISPOSITION.applied };
});

const quotes = Effect.fn("billing.api.quotes")(function* quotes(request: Request) {
  const { user } = yield* verifySession(request.headers);
  const offered = yield* listMemberQuotes(user.id);
  return {
    quotes: offered.map((quote) => ({
      amountTotal: quote.amountTotal,
      collectionMethod: quote.collectionMethod,
      currency: quote.currency,
      expiresAt: quote.expiresAt,
      status: quote.status,
      stripeQuoteId: quote.stripeQuoteId,
      ...(quote.daysUntilDue === undefined ? {} : { daysUntilDue: quote.daysUntilDue }),
    })),
  };
});

const usage = Effect.fn("billing.api.usage")(function* usage(request: Request) {
  const { user } = yield* verifySession(request.headers);
  const subscription = yield* findSubscription(user.id);
  const periodEnd = subscription?.currentPeriodEnd ?? undefined;
  const periodStart = DateTime.toDate(
    periodEnd === undefined
      ? DateTime.makeUnsafe(0)
      : DateTime.subtract(DateTime.fromDateUnsafe(periodEnd), { months: 1 }),
  );
  return {
    ...(yield* aiUsageSince({ memberId: user.id, since: periodStart })),
    since: periodStart,
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
    .get("/billing/plan", ...api.route({ response: PlanView }, plan, failures))
    .get("/billing/offer", ...api.route({ response: OfferView }, offer, failures))
    .post("/billing/checkout", ...api.route({ response: HostedPage }, checkout, failures))
    .post("/billing/portal", ...api.route({ response: HostedPage }, portal, failures))
    .get("/billing/invoices", ...api.route({ response: InvoiceList }, invoices, failures))
    .get("/billing/quotes", ...api.route({ response: QuoteList }, quotes, failures))
    .get("/billing/usage", ...api.route({ response: UsageView }, usage, failures))
    .post(
      "/billing/invoice-payment",
      ...api.route({ response: WebhookReceipt }, payByInvoice, failures),
    )
    .post("/billing/webhook", ...api.route({ response: WebhookReceipt }, webhook, failures));
}
export { billingApi };
