import {
  aiMeterEventName,
  aiUsageUnitAmount,
  stripeApiVersion,
  stripeWebhookEvents,
} from "@repo/config";
import { apiRoot } from "@repo/runtime/http";
import * as Output from "alchemy/Output";
import * as Stripe from "alchemy/Stripe";
import { Effect } from "effect";

import { stripeSandboxKey } from "./settings.ts";

import type { Redacted } from "effect";

const billingProgram = Effect.fn("billingProgram")(function* billingProgram(
  prefix: string,
  origin: string,
) {
  const secretKey = yield* stripeSandboxKey;
  const product = yield* Stripe.Product("PaidPlan", { name: `${prefix} paid plan` });
  const price = yield* Stripe.Price("PaidMonthly", {
    currency: "jpy",
    product: product.id,
    recurring: { interval: "month" },
    unitAmount: 500,
  });
  const meter = yield* Stripe.BillingMeter("AiUsage", {
    defaultAggregation: { formula: "sum" },
    displayName: `${prefix} AI usage`,
    eventName: aiMeterEventName,
  });
  const meteredPrice = yield* Stripe.Price("AiUsageMonthly", {
    currency: "jpy",
    product: product.id,
    recurring: { interval: "month", meter: meter.id, usageType: "metered" },
    unitAmount: aiUsageUnitAmount,
  });
  const webhook = yield* Stripe.WebhookEndpoint("BillingWebhook", {
    apiVersion: stripeApiVersion,
    enabledEvents: [...stripeWebhookEvents],
    url: `${origin}${apiRoot}/billing/webhook`,
  });
  return {
    STRIPE_METERED_PRICE_ID: meteredPrice.id,
    STRIPE_PRICE_ID: price.id,
    STRIPE_SECRET_KEY: secretKey,
    STRIPE_WEBHOOK_SECRET: webhook.secret.pipe(
      Output.mapEffect((secret: Redacted.Redacted | undefined) =>
        secret === undefined
          ? Effect.die(new Error("Stripe webhook endpoint has no stored signing secret"))
          : Effect.succeed(secret),
      ),
    ),
  };
});

export { billingProgram };
