import { priceIntervals, readStripeConfig } from "@repo/config";
import { withSpan } from "@repo/observability";
import { Context, Effect, Layer, Schema } from "effect";

import { StripeEventUnreadable } from "./stripe-event-unreadable.ts";
import { StripeFailure } from "./stripe-failure.ts";
import { verifyStripeSignature } from "./stripe-signature.ts";

import type { ConfigurationInvalid, PriceInterval, StripeConfig } from "@repo/config";
import type { StripeSignatureInvalid } from "./stripe-signature-invalid.ts";

const stripeApi = "https://api.stripe.com/v1";
const patience = "15 seconds";

const StripeEvent = Schema.Struct({
  created: Schema.Finite,
  data: Schema.Struct({ object: Schema.Unknown }),
  id: Schema.String,
  type: Schema.String,
});
type StripeEvent = typeof StripeEvent.Type;

const HostedSession = Schema.Struct({ url: Schema.String });

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

interface StripeShape {
  readonly createCheckoutSession: (input: CheckoutInput) => Effect.Effect<string, StripeFailure>;
  readonly createPortalSession: (input: PortalInput) => Effect.Effect<string, StripeFailure>;
  readonly offer: Effect.Effect<Offer, StripeFailure>;
  readonly readEvent: (
    payload: string,
    signature: string | null,
  ) => Effect.Effect<StripeEvent, StripeSignatureInvalid | StripeEventUnreadable>;
}

type Decodable = Schema.Top & { readonly DecodingServices: never };

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
  secretKey: string,
  path: string,
  form: URLSearchParams | undefined,
): Effect.Effect<unknown, StripeFailure> {
  return Effect.tryPromise({
    catch: (cause) => new StripeFailure({ cause, reason: "request_failed" }),
    try: () =>
      fetchImpl(`${stripeApi}${path}`, {
        ...(form === undefined ? {} : { body: form }),
        headers: {
          authorization: `Bearer ${secretKey}`,
          ...(form === undefined
            ? {}
            : {
                "content-type": "application/x-www-form-urlencoded",
                "idempotency-key": crypto.randomUUID(),
              }),
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

function checkoutForm(priceId: string, input: CheckoutInput): URLSearchParams {
  return new URLSearchParams({
    cancel_url: input.cancelUrl,
    client_reference_id: input.memberId,
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    mode: "subscription",
    "subscription_data[metadata][member_id]": input.memberId,
    success_url: input.successUrl,
    ...("id" in input.customer
      ? { customer: input.customer.id }
      : { customer_email: input.customer.email }),
  });
}

function stripeService(fetchImpl: typeof fetch, config: StripeConfig): StripeShape {
  const send = (path: string, form?: URLSearchParams): Effect.Effect<unknown, StripeFailure> =>
    request(fetchImpl, config.secretKey, path, form);
  return {
    createCheckoutSession: (input) =>
      send("/checkout/sessions", checkoutForm(config.priceId, input)).pipe(
        Effect.flatMap((body) => decodeStripe(HostedSession, body)),
        Effect.map((session) => session.url),
      ),
    createPortalSession: (input) =>
      send(
        "/billing_portal/sessions",
        new URLSearchParams({ customer: input.customerId, return_url: input.returnUrl }),
      ).pipe(
        Effect.flatMap((body) => decodeStripe(HostedSession, body)),
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
export type { CheckoutInput, Offer, PortalInput, StripeEvent };
