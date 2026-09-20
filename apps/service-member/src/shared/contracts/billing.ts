import { plans, priceIntervals, subscriptionStatuses, webhookOutcomes } from "@repo/config";
import { Schema } from "effect";

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

export { HostedPage, OfferView, PlanView, WebhookReceipt };
