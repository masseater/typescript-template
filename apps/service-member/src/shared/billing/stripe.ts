import { invoiceDueDays, priceIntervals, readStripeConfig, stripeApiVersion } from "@repo/config";
import { withSpan } from "@repo/observability";
import { Redirect } from "@repo/runtime/contracts";
import { Context, Effect, Layer, Redacted, Schema } from "effect";

import { StripeEventUnreadable } from "./stripe-event-unreadable.ts";
import { StripeFailure } from "./stripe-failure.ts";
import { verifyStripeSignature } from "./stripe-signature.ts";

import type { ConfigurationInvalid, PriceInterval, StripeConfig } from "@repo/config";
import type { Decodable } from "@repo/runtime/contracts";
import type { StripeSignatureInvalid } from "./stripe-signature-invalid.ts";

const stripeApi = "https://api.stripe.com/v1";
const patience = "15 seconds";
const checkoutIntegration = "member-subscription-qhzvtkdw";

const StripeEvent = Schema.Struct({
  created: Schema.Finite,
  data: Schema.Struct({ object: Schema.Unknown }),
  id: Schema.String,
  type: Schema.String,
});
type StripeEvent = typeof StripeEvent.Type;

const RecurringPrice = Schema.Struct({
  currency: Schema.String,
  recurring: Schema.Struct({
    interval: Schema.Literals(priceIntervals),
    interval_count: Schema.Finite,
  }),
  unit_amount: Schema.Finite,
});

interface Offer {
  readonly currency: string;
  readonly interval: PriceInterval;
  readonly intervalCount: number;
  readonly unitAmount: number;
}

const IssuedInvoiceBody = Schema.Struct({
  amount_due: Schema.Finite,
  amount_remaining: Schema.Finite,
  currency: Schema.String,
  hosted_invoice_url: Schema.optionalKey(Schema.NullOr(Schema.String)),
  id: Schema.String,
  status: Schema.String,
});

interface IssuedInvoice {
  readonly amountDue: number;
  readonly amountRemaining: number;
  readonly currency: string;
  readonly hostedInvoiceUrl: string | undefined;
  readonly status: string;
  readonly stripeInvoiceId: string;
}

interface CheckoutInput {
  readonly cancelUrl: string;
  readonly customer: Readonly<{ email: string } | { id: string }>;
  readonly memberId: string;
  readonly successUrl: string;
}

interface PortalInput {
  readonly customerId: string;
  readonly returnUrl: string;
}

interface InvoiceInput {
  readonly amount: number;
  readonly currency: string;
  readonly customerId: string;
  readonly description: string;
  readonly memberId: string;
  readonly originKey: string;
}

interface StripeShape {
  readonly createCheckoutSession: (input: CheckoutInput) => Effect.Effect<string, StripeFailure>;
  readonly createInvoice: (input: InvoiceInput) => Effect.Effect<IssuedInvoice, StripeFailure>;
  readonly createPortalSession: (input: PortalInput) => Effect.Effect<string, StripeFailure>;
  readonly offer: Effect.Effect<Offer, StripeFailure>;
  readonly payByInvoice: (subscriptionId: string) => Effect.Effect<void, StripeFailure>;
  readonly readEvent: (
    payload: string,
    signature: string | null,
  ) => Effect.Effect<StripeEvent, StripeSignatureInvalid | StripeEventUnreadable>;
}

function decodeStripe<Contract extends Decodable>(
  schema: Contract,
  input: unknown,
): Effect.Effect<Contract["Type"], StripeFailure> {
  return Schema.decodeUnknownEffect(schema)(input).pipe(
    Effect.mapError((cause) => new StripeFailure({ cause, reason: "response_invalid" })),
  );
}

function request(
  fetchImpl: typeof fetch,
  secretKey: Redacted.Redacted,
  path: string,
  form: URLSearchParams | undefined,
  idempotencyKey: string | undefined,
): Effect.Effect<unknown, StripeFailure> {
  return Effect.tryPromise({
    catch: (cause) => new StripeFailure({ cause, reason: "request_failed" }),
    try: () =>
      fetchImpl(`${stripeApi}${path}`, {
        ...(form === undefined ? {} : { body: form }),
        headers: {
          authorization: `Bearer ${Redacted.value(secretKey)}`,
          "stripe-version": stripeApiVersion,
          ...(form === undefined ? {} : { "content-type": "application/x-www-form-urlencoded" }),
          ...(idempotencyKey === undefined ? {} : { "idempotency-key": idempotencyKey }),
        },
        method: form === undefined ? "GET" : "POST",
      }),
  }).pipe(
    Effect.flatMap((response) =>
      response.ok
        ? Effect.tryPromise({
            catch: (cause) => new StripeFailure({ cause, reason: "response_invalid" }),
            try: (): Promise<unknown> => response.json(),
          })
        : Effect.fail(new StripeFailure({ reason: "request_failed", status: response.status })),
    ),
    Effect.timeoutOrElse({
      duration: patience,
      orElse: () => Effect.fail(new StripeFailure({ reason: "timed_out" })),
    }),
    withSpan("stripe.request", { attributes: { "stripe.path": path } }),
  );
}

function taxFields(config: StripeConfig, returning: boolean): Record<string, string> {
  return config.automaticTax
    ? {
        "automatic_tax[enabled]": "true",
        "tax_id_collection[enabled]": "true",
        ...(returning
          ? { "customer_update[address]": "auto", "customer_update[name]": "auto" }
          : {}),
      }
    : {};
}

const noTrial = 0;

function trialFields(config: StripeConfig): Record<string, string> {
  return config.trialPeriodDays === noTrial
    ? {}
    : {
        "subscription_data[trial_period_days]": String(config.trialPeriodDays),
        "subscription_data[trial_settings][end_behavior][missing_payment_method]": "cancel",
      };
}

function asIssuedInvoice(invoice: typeof IssuedInvoiceBody.Type): IssuedInvoice {
  return {
    amountDue: invoice.amount_due,
    amountRemaining: invoice.amount_remaining,
    currency: invoice.currency,
    hostedInvoiceUrl: invoice.hosted_invoice_url ?? undefined,
    status: invoice.status,
    stripeInvoiceId: invoice.id,
  };
}

function invoiceItemForm(input: InvoiceInput): URLSearchParams {
  return new URLSearchParams({
    amount: String(input.amount),
    currency: input.currency,
    customer: input.customerId,
    description: input.description,
  });
}

function invoiceForm(config: StripeConfig, input: InvoiceInput): URLSearchParams {
  return new URLSearchParams({
    auto_advance: "true",
    collection_method: "send_invoice",
    customer: input.customerId,
    days_until_due: String(invoiceDueDays),
    "metadata[member_id]": input.memberId,
    "metadata[origin_key]": input.originKey,
    pending_invoice_items_behavior: "include",
    ...(config.automaticTax ? { "automatic_tax[enabled]": "true" } : {}),
  });
}

function checkoutForm(config: StripeConfig, input: CheckoutInput): URLSearchParams {
  const customerFields =
    "id" in input.customer
      ? { customer: input.customer.id }
      : { customer_email: input.customer.email };
  return new URLSearchParams({
    cancel_url: input.cancelUrl,
    client_reference_id: input.memberId,
    integration_identifier: checkoutIntegration,
    "line_items[0][price]": config.priceId,
    "line_items[0][quantity]": "1",
    mode: "subscription",
    "subscription_data[metadata][member_id]": input.memberId,
    success_url: input.successUrl,
    ...customerFields,
    ...taxFields(config, "customer" in customerFields),
    ...trialFields(config),
  });
}

function stripeService(fetchImpl: typeof fetch, config: StripeConfig): StripeShape {
  const send = (
    path: string,
    form?: URLSearchParams,
    idempotencyKey?: string,
  ): Effect.Effect<unknown, StripeFailure> =>
    request(fetchImpl, config.secretKey, path, form, idempotencyKey);
  return {
    createCheckoutSession: (input) =>
      send("/checkout/sessions", checkoutForm(config, input)).pipe(
        Effect.flatMap((body) => decodeStripe(Redirect, body)),
        Effect.map((session) => session.url),
      ),
    createInvoice: (input) =>
      send("/invoiceitems", invoiceItemForm(input), `${input.originKey}:item`).pipe(
        Effect.flatMap(() =>
          send("/invoices", invoiceForm(config, input), `${input.originKey}:invoice`),
        ),
        Effect.flatMap((body) => decodeStripe(IssuedInvoiceBody, body)),
        Effect.map(asIssuedInvoice),
      ),
    payByInvoice: (subscriptionId) =>
      send(
        `/subscriptions/${subscriptionId}`,
        new URLSearchParams({
          collection_method: "send_invoice",
          days_until_due: String(invoiceDueDays),
        }),
      ).pipe(Effect.asVoid),
    createPortalSession: (input) =>
      send(
        "/billing_portal/sessions",
        new URLSearchParams({ customer: input.customerId, return_url: input.returnUrl }),
      ).pipe(
        Effect.flatMap((body) => decodeStripe(Redirect, body)),
        Effect.map((session) => session.url),
      ),
    offer: send(`/prices/${config.priceId}`).pipe(
      Effect.flatMap((body) => decodeStripe(RecurringPrice, body)),
      Effect.map((price): Offer => ({
        currency: price.currency,
        interval: price.recurring.interval,
        intervalCount: price.recurring.interval_count,
        unitAmount: price.unit_amount,
      })),
    ),
    readEvent: (payload, signature) =>
      verifyStripeSignature(config.webhookSecret, payload, signature).pipe(
        Effect.flatMap(() =>
          Schema.decodeEffect(Schema.fromJsonString(Schema.Unknown))(payload).pipe(
            Effect.mapError(() => new StripeEventUnreadable()),
          ),
        ),
        Effect.flatMap((json) =>
          Schema.decodeUnknownEffect(StripeEvent)(json).pipe(
            Effect.mapError(() => new StripeEventUnreadable()),
          ),
        ),
      ),
  };
}

class Stripe extends Context.Service<Stripe, StripeShape>()("#shared/billing/Stripe") {
  public static layer(config: StripeConfig): Layer.Layer<Stripe> {
    return Layer.succeed(Stripe, Stripe.of(stripeService(fetch, config)));
  }

  public static fromEnvironment(env: unknown): Layer.Layer<Stripe, ConfigurationInvalid> {
    return Layer.unwrap(Effect.map(readStripeConfig(env), (config) => Stripe.layer(config)));
  }
}

export { Stripe };
export type { StripeEvent };
