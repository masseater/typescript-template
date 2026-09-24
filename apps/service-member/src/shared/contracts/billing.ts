import { plans, priceIntervals, subscriptionStatuses, webhookOutcomes } from "@repo/config";
import { Redirect } from "@repo/runtime/contracts";
import { Option, Schema } from "effect";

const PlanView = Schema.Struct({
  cancelAtPeriodEnd: Schema.Boolean,
  currentPeriodEnd: Schema.optional(Schema.DateFromString),
  plan: Schema.Literals(plans),
  status: Schema.optional(Schema.Literals(subscriptionStatuses)),
});

const OfferView = Schema.Struct({
  currency: Schema.String,
  interval: Schema.Literals(priceIntervals),
  intervalCount: Schema.Finite,
  unitAmount: Schema.Finite,
});

const HostedPage = Redirect;

const InvoiceView = Schema.Struct({
  amountCredited: Schema.Finite,
  amountDue: Schema.Finite,
  amountPaid: Schema.Finite,
  amountRefunded: Schema.Finite,
  amountRemaining: Schema.Finite,
  currency: Schema.String,
  hostedInvoiceUrl: Schema.optional(Schema.String),
  issuedAt: Schema.DateFromString,
  status: Schema.String,
  stripeInvoiceId: Schema.String,
});

const InvoiceList = Schema.Struct({ invoices: Schema.Array(InvoiceView) });

const WebhookReceipt = Schema.Struct({ outcome: Schema.Literals(webhookOutcomes) });

const checkoutReturns = ["cancel", "success"] as const;
type CheckoutReturn = (typeof checkoutReturns)[number];
const CHECKOUT_RETURN = {
  cancel: checkoutReturns[0],
  success: checkoutReturns[1],
} as const satisfies Record<string, CheckoutReturn>;

const CheckoutReturnSearch = Schema.Struct({
  checkout: Schema.optionalKey(Schema.Literals(checkoutReturns)),
});

const decodeCheckoutReturn = Schema.decodeUnknownOption(CheckoutReturnSearch);

function readCheckoutReturn(raw: unknown): typeof CheckoutReturnSearch.Type {
  return Option.getOrElse(decodeCheckoutReturn(raw), () => ({}));
}

export {
  CHECKOUT_RETURN,
  HostedPage,
  InvoiceList,
  OfferView,
  PlanView,
  WebhookReceipt,
  readCheckoutReturn,
};
