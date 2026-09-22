import { plans, subscriptionStatuses, webhookOutcomes } from "@repo/config";
import { PaidPlanRequired, StripeEventUnreadable } from "@repo/db";
import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";

import { SessionIdentityMiddleware, SessionInvalid, SessionRequired } from "./session-identity.ts";

const BillingPlanView = Schema.Struct({
  cancelAtPeriodEnd: Schema.Boolean,
  currentPeriodEnd: Schema.optionalKey(Schema.Finite),
  plan: Schema.Literals(plans),
  status: Schema.optionalKey(Schema.Literals(subscriptionStatuses)),
});

const MemberSubscriptionView = Schema.Struct({
  cancelAtPeriodEnd: Schema.Boolean,
  currentPeriodEnd: Schema.optionalKey(Schema.Finite),
  memberId: Schema.String,
  status: Schema.Literals(subscriptionStatuses),
  stripeCustomerId: Schema.String,
  stripeSubscriptionId: Schema.String,
});

const StripeEventPayload = Schema.Struct({
  created: Schema.Finite,
  data: Schema.Struct({ object: Schema.Unknown }),
  id: Schema.String,
  type: Schema.String,
});

const WebhookOutcomeView = Schema.Struct({
  outcome: Schema.Literals(webhookOutcomes),
});

const SessionError = Schema.Union([SessionRequired, SessionInvalid]);

const getBillingPlan = Rpc.make("getBillingPlan", {
  error: SessionError,
  payload: {},
  success: BillingPlanView,
}).middleware(SessionIdentityMiddleware);

const getMemberSubscription = Rpc.make("getMemberSubscription", {
  error: SessionError,
  payload: {},
  success: Schema.NullOr(MemberSubscriptionView),
}).middleware(SessionIdentityMiddleware);

const requirePaidMembership = Rpc.make("requirePaidMembership", {
  error: Schema.Union([PaidPlanRequired, SessionRequired, SessionInvalid]),
  payload: {},
  success: Schema.Void,
}).middleware(SessionIdentityMiddleware);

const applyStripeEvent = Rpc.make("applyStripeEvent", {
  error: StripeEventUnreadable,
  payload: StripeEventPayload,
  success: WebhookOutcomeView,
});

export class MemberBillingRpcs extends RpcGroup.make(
  getBillingPlan,
  getMemberSubscription,
  requirePaidMembership,
  applyStripeEvent,
) {}

export {
  BillingPlanView,
  MemberSubscriptionView,
  StripeEventPayload,
  StripeEventUnreadable,
  WebhookOutcomeView,
  applyStripeEvent,
  getBillingPlan,
  getMemberSubscription,
  requirePaidMembership,
};
