/** @canonical-values config.plan */
const plans = ["free", "paid"] as const;
type Plan = (typeof plans)[number];
const PLAN = { free: plans[0], paid: plans[1] } as const satisfies Record<string, Plan>;

/** @canonical-values config.subscription-status */
const subscriptionStatuses = [
  "active",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "past_due",
  "paused",
  "trialing",
  "unpaid",
] as const;
type SubscriptionStatus = (typeof subscriptionStatuses)[number];
const SUBSCRIPTION_STATUS = {
  active: subscriptionStatuses[0],
  canceled: subscriptionStatuses[1],
  incomplete: subscriptionStatuses[2],
  incompleteExpired: subscriptionStatuses[3],
  pastDue: subscriptionStatuses[4],
  paused: subscriptionStatuses[5],
  trialing: subscriptionStatuses[6],
  unpaid: subscriptionStatuses[7],
} as const satisfies Record<string, SubscriptionStatus>;

const paidStatuses: readonly SubscriptionStatus[] = [
  SUBSCRIPTION_STATUS.active,
  SUBSCRIPTION_STATUS.trialing,
];

/** @canonical-values config.webhook-outcome */
const webhookOutcomes = ["applied", "duplicate", "ignored"] as const;
type WebhookOutcome = (typeof webhookOutcomes)[number];
const WEBHOOK_OUTCOME = {
  applied: webhookOutcomes[0],
  duplicate: webhookOutcomes[1],
  ignored: webhookOutcomes[2],
} as const satisfies Record<string, WebhookOutcome>;

/** @canonical-values config.price-interval */
const priceIntervals = ["day", "week", "month", "year"] as const;
type PriceInterval = (typeof priceIntervals)[number];

export {
  PLAN,
  SUBSCRIPTION_STATUS,
  WEBHOOK_OUTCOME,
  paidStatuses,
  plans,
  priceIntervals,
  subscriptionStatuses,
  webhookOutcomes,
};
export type { Plan, PriceInterval, SubscriptionStatus, WebhookOutcome };
