import { SUBSCRIPTION_STATUS, WEBHOOK_OUTCOME, subscriptionStatuses } from "@repo/config";
import { attachCheckout, markPaymentFailed, memberOfCustomer, recordSubscription } from "@repo/db";
import { Effect, Schema, DateTime } from "effect";

import { StripeEventUnreadable } from "./stripe-event-unreadable.ts";

import type { WebhookOutcome } from "@repo/config";
import type { StripeEventRecord, SubscriptionRecord } from "@repo/db";
import type { StripeEvent } from "./stripe.ts";

const millisecondsPerSecond = 1000;

const Metadata = Schema.optionalKey(
  Schema.Record(Schema.String, Schema.String).pipe(Schema.NullOr),
);

const CheckoutSession = Schema.Struct({
  client_reference_id: Schema.NullOr(Schema.String),
  customer: Schema.NullOr(Schema.String),
  metadata: Metadata,
  mode: Schema.String,
  payment_status: Schema.String,
  subscription: Schema.NullOr(Schema.String),
});

const PeriodItems = Schema.Struct({
  data: Schema.Array(Schema.Struct({ current_period_end: Schema.optionalKey(Schema.Finite) })),
});

const Subscription = Schema.Struct({
  cancel_at_period_end: Schema.Boolean,
  current_period_end: Schema.optionalKey(Schema.Finite),
  customer: Schema.String,
  id: Schema.String,
  items: Schema.optionalKey(PeriodItems),
  metadata: Metadata,
  status: Schema.Literals(subscriptionStatuses),
});

const Invoice = Schema.Struct({
  parent: Schema.optionalKey(
    Schema.NullOr(
      Schema.Struct({
        subscription_details: Schema.optionalKey(
          Schema.NullOr(Schema.Struct({ subscription: Schema.NullOr(Schema.String) })),
        ),
      }),
    ),
  ),
  subscription: Schema.optionalKey(Schema.NullOr(Schema.String)),
});

type Decodable = Schema.Top & { readonly DecodingServices: never };

function readObject<Contract extends Decodable>(
  schema: Contract,
  object: unknown,
): Effect.Effect<Contract["Type"], StripeEventUnreadable> {
  return Schema.decodeUnknownEffect(schema)(object).pipe(
    Effect.mapError(() => new StripeEventUnreadable()),
  );
}

function eventRecord(event: StripeEvent): StripeEventRecord {
  return {
    createdAt: DateTime.toDate(DateTime.makeUnsafe(event.created * millisecondsPerSecond)),
    id: event.id,
    type: event.type,
  };
}

function secondsToDate(seconds: number | undefined): Date | undefined {
  return seconds === undefined
    ? undefined
    : DateTime.toDate(DateTime.makeUnsafe(seconds * millisecondsPerSecond));
}

const paidPaymentStatuses: ReadonlySet<string> = new Set(["no_payment_required", "paid"]);

const completeCheckout = Effect.fn("completeCheckout")(function* completeCheckout(
  event: StripeEvent,
) {
  const session = yield* readObject(CheckoutSession, event.data.object);
  const memberId = session.client_reference_id ?? session.metadata?.["member_id"];
  if (
    session.mode !== "subscription" ||
    session.customer === null ||
    session.subscription === null ||
    memberId === undefined
  ) {
    return WEBHOOK_OUTCOME.ignored;
  }
  const record: SubscriptionRecord = {
    cancelAtPeriodEnd: false,
    currentPeriodEnd: undefined,
    memberId,
    status: paidPaymentStatuses.has(session.payment_status)
      ? SUBSCRIPTION_STATUS.active
      : SUBSCRIPTION_STATUS.incomplete,
    stripeCustomerId: session.customer,
    stripeSubscriptionId: session.subscription,
  };
  return yield* attachCheckout(eventRecord(event), record);
});

const syncSubscription = Effect.fn("syncSubscription")(function* syncSubscription(
  event: StripeEvent,
) {
  const subscription = yield* readObject(Subscription, event.data.object);
  const memberId =
    subscription.metadata?.["member_id"] ?? (yield* memberOfCustomer(subscription.customer));
  if (memberId === undefined) {
    return WEBHOOK_OUTCOME.ignored;
  }
  const record: SubscriptionRecord = {
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    currentPeriodEnd: secondsToDate(
      subscription.current_period_end ?? subscription.items?.data[0]?.current_period_end,
    ),
    memberId,
    status: subscription.status,
    stripeCustomerId: subscription.customer,
    stripeSubscriptionId: subscription.id,
  };
  return yield* recordSubscription(eventRecord(event), record);
});

const failPayment = Effect.fn("failPayment")(function* failPayment(event: StripeEvent) {
  const invoice = yield* readObject(Invoice, event.data.object);
  const subscriptionId =
    invoice.subscription ?? invoice.parent?.subscription_details?.subscription ?? undefined;
  if (subscriptionId === undefined) {
    return WEBHOOK_OUTCOME.ignored;
  }
  return yield* markPaymentFailed(eventRecord(event), subscriptionId);
});

const handleStripeEvent = Effect.fn("handleStripeEvent")(function* handleStripeEvent(
  event: StripeEvent,
) {
  switch (event.type) {
    case "checkout.session.completed": {
      return yield* completeCheckout(event);
    }
    case "customer.subscription.created":
    case "customer.subscription.deleted":
    case "customer.subscription.updated": {
      return yield* syncSubscription(event);
    }
    case "invoice.payment_failed": {
      return yield* failPayment(event);
    }
    default: {
      return WEBHOOK_OUTCOME.ignored satisfies WebhookOutcome;
    }
  }
});

export { handleStripeEvent };
