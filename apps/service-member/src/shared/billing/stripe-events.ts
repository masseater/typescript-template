import {
  SUBSCRIPTION_STATUS,
  WEBHOOK_DISPOSITION,
  stripeWebhookEvents,
  subscriptionStatuses,
} from "@repo/config";
import {
  acceptQuote,
  applyInvoiceState,
  applyQuoteState,
  attachCheckout,
  creditInvoice,
  markPaymentFailed,
  memberOfCustomer,
  recordSubscription,
  refundInvoice,
  settleInvoicePayment,
} from "@repo/db";
import { Effect, Schema, DateTime } from "effect";

import { StripeEventUnreadable } from "./stripe-event-unreadable.ts";
import { Stripe } from "./stripe.ts";

import type { StripeWebhookEvent, WebhookOutcome } from "@repo/config";
import type { InvoiceState, QuoteState, StripeEventRecord, SubscriptionRecord } from "@repo/db";
import type { Decodable } from "@repo/runtime/contracts";
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

const FinalizedInvoice = Schema.Struct({
  amount_due: Schema.Finite,
  amount_paid: Schema.Finite,
  amount_remaining: Schema.Finite,
  currency: Schema.String,
  customer: Schema.String,
  hosted_invoice_url: Schema.optionalKey(Schema.NullOr(Schema.String)),
  id: Schema.String,
  metadata: Metadata,
  status: Schema.String,
});

const CreditNote = Schema.Struct({
  amount: Schema.Finite,
  invoice: Schema.String,
});

const RefundedCharge = Schema.Struct({
  amount_refunded: Schema.Finite,
  invoice: Schema.optionalKey(Schema.NullOr(Schema.String)),
});

const Quote = Schema.Struct({
  amount_total: Schema.Finite,
  collection_method: Schema.String,
  currency: Schema.String,
  customer: Schema.NullOr(Schema.String),
  expires_at: Schema.Finite,
  id: Schema.String,
  invoice_settings: Schema.optionalKey(
    Schema.NullOr(
      Schema.Struct({ days_until_due: Schema.optionalKey(Schema.NullOr(Schema.Finite)) }),
    ),
  ),
  metadata: Metadata,
  status: Schema.String,
  subscription: Schema.optionalKey(Schema.NullOr(Schema.String)),
});

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
    return WEBHOOK_DISPOSITION.ignored;
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

function subscriptionRecord(
  memberId: string,
  subscription: typeof Subscription.Type,
): SubscriptionRecord {
  return {
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    currentPeriodEnd: secondsToDate(
      subscription.current_period_end ?? subscription.items?.data[0]?.current_period_end,
    ),
    memberId,
    status: subscription.status,
    stripeCustomerId: subscription.customer,
    stripeSubscriptionId: subscription.id,
  };
}

const syncSubscription = Effect.fn("syncSubscription")(function* syncSubscription(
  event: StripeEvent,
) {
  const subscription = yield* readObject(Subscription, event.data.object);
  const memberId =
    (yield* memberOfCustomer(subscription.customer)) ?? subscription.metadata?.["member_id"];
  if (memberId === undefined) {
    return WEBHOOK_DISPOSITION.ignored;
  }
  return yield* recordSubscription(eventRecord(event), subscriptionRecord(memberId, subscription));
});

const invoiceSubscription = Effect.fn("invoiceSubscription")(function* invoiceSubscription(
  event: StripeEvent,
) {
  const invoice = yield* readObject(Invoice, event.data.object);
  return invoice.subscription ?? invoice.parent?.subscription_details?.subscription ?? undefined;
});

const failPayment = Effect.fn("failPayment")(function* failPayment(event: StripeEvent) {
  const subscriptionId = yield* invoiceSubscription(event);
  if (subscriptionId === undefined) {
    return WEBHOOK_DISPOSITION.ignored;
  }
  return yield* markPaymentFailed(eventRecord(event), subscriptionId);
});

const invoiceLedgerState = Effect.fn("invoiceLedgerState")(function* invoiceLedgerState(
  event: StripeEvent,
) {
  const invoice = yield* readObject(FinalizedInvoice, event.data.object);
  const memberId = invoice.metadata?.["member_id"] ?? (yield* memberOfCustomer(invoice.customer));
  return memberId === undefined
    ? undefined
    : ({
        amountDue: invoice.amount_due,
        amountPaid: invoice.amount_paid,
        amountRemaining: invoice.amount_remaining,
        currency: invoice.currency,
        hostedInvoiceUrl: invoice.hosted_invoice_url ?? undefined,
        memberId,
        originKey: invoice.metadata?.["origin_key"] ?? `invoice:${invoice.id}`,
        status: invoice.status,
        stripeInvoiceId: invoice.id,
      } satisfies InvoiceState);
});

const recordInvoice = Effect.fn("recordInvoice")(function* recordInvoice(event: StripeEvent) {
  const ledgerState = yield* invoiceLedgerState(event);
  return ledgerState === undefined
    ? WEBHOOK_DISPOSITION.ignored
    : yield* applyInvoiceState(eventRecord(event), ledgerState);
});

const settlePayment = Effect.fn("settlePayment")(function* settlePayment(event: StripeEvent) {
  const ledgerState = yield* invoiceLedgerState(event);
  if (ledgerState === undefined) {
    return WEBHOOK_DISPOSITION.ignored;
  }
  return yield* settleInvoicePayment(eventRecord(event), {
    invoice: ledgerState,
    stripeSubscriptionId: yield* invoiceSubscription(event),
  });
});

const creditNoteIssued = Effect.fn("creditNoteIssued")(function* creditNoteIssued(
  event: StripeEvent,
) {
  const creditNote = yield* readObject(CreditNote, event.data.object);
  return yield* creditInvoice(eventRecord(event), {
    amount: creditNote.amount,
    stripeInvoiceId: creditNote.invoice,
  });
});

const chargeRefunded = Effect.fn("chargeRefunded")(function* chargeRefunded(event: StripeEvent) {
  const charge = yield* readObject(RefundedCharge, event.data.object);
  const refundedInvoiceId = charge.invoice ?? undefined;
  if (refundedInvoiceId === undefined) {
    return WEBHOOK_DISPOSITION.ignored;
  }
  return yield* refundInvoice(eventRecord(event), {
    amountRefunded: charge.amount_refunded,
    stripeInvoiceId: refundedInvoiceId,
  });
});

const quoteLedgerState = Effect.fn("quoteLedgerState")(function* quoteLedgerState(
  event: StripeEvent,
) {
  const quote = yield* readObject(Quote, event.data.object);
  const memberId =
    (quote.customer === null ? undefined : yield* memberOfCustomer(quote.customer)) ??
    quote.metadata?.["member_id"];
  return memberId === undefined
    ? undefined
    : ({
        amountTotal: quote.amount_total,
        collectionMethod: quote.collection_method,
        currency: quote.currency,
        daysUntilDue: quote.invoice_settings?.days_until_due ?? undefined,
        expiresAt: DateTime.toDate(DateTime.makeUnsafe(quote.expires_at * millisecondsPerSecond)),
        memberId,
        status: quote.status,
        stripeQuoteId: quote.id,
        stripeSubscriptionId: quote.subscription ?? undefined,
      } satisfies QuoteState);
});

const recordQuote = Effect.fn("recordQuote")(function* recordQuote(event: StripeEvent) {
  const ledgerState = yield* quoteLedgerState(event);
  return ledgerState === undefined
    ? WEBHOOK_DISPOSITION.ignored
    : yield* applyQuoteState(eventRecord(event), ledgerState);
});

const quoteAccepted = Effect.fn("quoteAccepted")(function* quoteAccepted(event: StripeEvent) {
  const ledgerState = yield* quoteLedgerState(event);
  if (ledgerState === undefined) {
    return WEBHOOK_DISPOSITION.ignored;
  }
  if (ledgerState.stripeSubscriptionId === undefined) {
    return yield* applyQuoteState(eventRecord(event), ledgerState);
  }
  const subscription = yield* readObject(
    Subscription,
    yield* (yield* Stripe).subscription(ledgerState.stripeSubscriptionId),
  );
  return yield* acceptQuote(eventRecord(event), {
    quote: ledgerState,
    subscription: subscriptionRecord(ledgerState.memberId, subscription),
  });
});

const eventHandlers = {
  "charge.refunded": chargeRefunded,
  "checkout.session.completed": completeCheckout,
  "credit_note.created": creditNoteIssued,
  "customer.subscription.created": syncSubscription,
  "customer.subscription.deleted": syncSubscription,
  "customer.subscription.updated": syncSubscription,
  "invoice.finalized": recordInvoice,
  "invoice.paid": settlePayment,
  "invoice.payment_failed": failPayment,
  "invoice.updated": recordInvoice,
  "quote.accepted": quoteAccepted,
  "quote.canceled": recordQuote,
  "quote.finalized": recordQuote,
} as const satisfies Record<StripeWebhookEvent, (event: StripeEvent) => unknown>;

const isHandledEvent = (type: string): type is StripeWebhookEvent =>
  stripeWebhookEvents.some((handled) => handled === type);

const handleStripeEvent = Effect.fn("handleStripeEvent")(function* handleStripeEvent(
  event: StripeEvent,
) {
  if (!isHandledEvent(event.type)) {
    return WEBHOOK_DISPOSITION.ignored satisfies WebhookOutcome;
  }
  return yield* eventHandlers[event.type](event);
});

export { handleStripeEvent };
