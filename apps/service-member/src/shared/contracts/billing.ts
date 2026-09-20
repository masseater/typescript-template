import { plans, priceIntervals, subscriptionStatuses, webhookOutcomes } from "@repo/config";
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
  intervalCount: Schema.Number,
  unitAmount: Schema.Number,
});

const HostedPage = Schema.Struct({ url: Schema.String });

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

export { CHECKOUT_RETURN, HostedPage, OfferView, PlanView, WebhookReceipt, readCheckoutReturn };
