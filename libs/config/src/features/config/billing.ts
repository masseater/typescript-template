export const plans = ["free", "paid"] as const;
export type Plan = (typeof plans)[number];
export const PLAN = { free: plans[0], paid: plans[1] } as const satisfies Record<string, Plan>;

/** @canonical-values config.subscription-status */
export const subscriptionStatuses = [
  "active",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "past_due",
  "paused",
  "trialing",
  "unpaid",
] as const;
export type SubscriptionStatus = (typeof subscriptionStatuses)[number];
export const SUBSCRIPTION_STATUS = {
  active: subscriptionStatuses[0],
  canceled: subscriptionStatuses[1],
  incomplete: subscriptionStatuses[2],
  incompleteExpired: subscriptionStatuses[3],
  pastDue: subscriptionStatuses[4],
  paused: subscriptionStatuses[5],
  trialing: subscriptionStatuses[6],
  unpaid: subscriptionStatuses[7],
} as const satisfies Record<string, SubscriptionStatus>;

export const paidStatuses: readonly SubscriptionStatus[] = [
  SUBSCRIPTION_STATUS.active,
  SUBSCRIPTION_STATUS.trialing,
];

/** @canonical-values config.webhook-outcome */
export const webhookOutcomes = ["applied", "duplicate", "ignored"] as const;
export type WebhookOutcome = (typeof webhookOutcomes)[number];
export const WEBHOOK_DISPOSITION = {
  applied: webhookOutcomes[0],
  duplicate: webhookOutcomes[1],
  ignored: webhookOutcomes[2],
} as const satisfies Record<string, WebhookOutcome>;

export const priceIntervals = ["day", "week", "month", "year"] as const;
export type PriceInterval = (typeof priceIntervals)[number];
