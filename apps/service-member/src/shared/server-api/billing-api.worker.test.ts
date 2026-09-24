import {
  MockNetwork,
  authTest,
  authTestSecret,
  origins,
  registerVerified,
  runWith,
  signInAs,
} from "@repo/auth/testing";
import {
  APPLICATION,
  PLAN,
  SUBSCRIPTION_STATUS,
  WEBHOOK_DISPOSITION,
  httpStatus,
  stripeApiVersion,
} from "@repo/config";
import { recordingSink } from "@repo/observability/testing";
import { appLayer } from "@repo/runtime/bindings";
import { apiRoot, apiRoutes } from "@repo/runtime/http";
import { appEnvironment } from "@repo/runtime/testing";
import { workerRuntime } from "@repo/runtime/worker";
import { DateTime, Effect, Layer, Schema } from "effect";
import { HttpResponse, http } from "msw";
import { describe, expect } from "vite-plus/test";

import { AgreementsView, InvoiceList, QuoteList } from "#shared/contracts/index.ts";
import { memberApi } from "./member-api.ts";
import { memberRequirementLayer } from "./member-requirement-layer.ts";

import type { BrowserClient } from "@repo/auth/testing";

type App = ReturnType<typeof billingApp>;

const origin = origins[APPLICATION.user];
const stripeApi = "https://api.stripe.com/v1";
const priceId = "price_TestMonthly";
const meteredPriceId = "price_TestMetered";
const webhookSecret = "whsec_testsecret";
const checkoutUrl = "https://checkout.stripe.com/c/pay/cs_test_session";
const portalUrl = "https://billing.stripe.com/p/session/test_portal";
const customerId = "cus_test_member";
const subscriptionId = "sub_test_member";
const trialPeriodDays = 14;
const invoiceId = "in_test_member";
const invoiceAmount = 980;
const hostedInvoiceUrl = "https://invoice.stripe.com/i/test_invoice";
const checkoutForms: URLSearchParams[] = [];
const invoiceKeys: string[] = [];
const millisecondsPerSecond = 1000;
const monthInSeconds = 30 * 24 * 60 * 60;
const hexRadix = 16;
const byteWidth = 2;
const JsonUnknown = Schema.fromJsonString(Schema.Unknown);

const routes = { "/api/billing/*": "billing-api", "/api/members": "members-api" };
const reporting = { log: recordingSink().sink, service: APPLICATION.user } as const;

function billingApp() {
  const environment = appEnvironment({
    APP_ORIGIN: origin,
    AUTH_SECRET: authTestSecret,
    STRIPE_METERED_PRICE_ID: meteredPriceId,
    STRIPE_PRICE_ID: priceId,
    STRIPE_SECRET_KEY: "sk_test_placeholder",
    STRIPE_WEBHOOK_SECRET: webhookSecret,
  });
  const runtime = workerRuntime(() => {
    const base = Layer.orDie(appLayer({ audience: APPLICATION.user, env: environment, routes }));
    return Layer.mergeAll(
      base,
      Layer.orDie(memberRequirementLayer(environment)).pipe(Layer.provide(base)),
    );
  });
  const api = apiRoutes(runtime, reporting);
  return memberApi(api);
}

function call(
  app: App,
  client: BrowserClient,
  path: string,
  body?: unknown,
): Effect.Effect<Response> {
  return Effect.gen(function* sendBilling() {
    const encoded = body === undefined ? undefined : yield* Schema.encodeEffect(JsonUnknown)(body);
    return yield* Effect.promise(() =>
      Promise.resolve(
        app.fetch(
          new Request(`${origin}${apiRoot}${path}`, {
            headers: {
              ...Object.fromEntries(client.cookieHeaders()),
              ...(encoded === undefined ? {} : { "content-type": "application/json" }),
            },
            method: encoded === undefined && body === undefined ? "GET" : "POST",
            ...(encoded === undefined ? {} : { body: encoded }),
          }),
        ),
      ),
    );
  }).pipe(Effect.orDie);
}

function json(response: Response): Effect.Effect<unknown> {
  return Effect.promise(() => response.json() as Promise<unknown>);
}

function nowSeconds(): number {
  return Math.floor(DateTime.toEpochMillis(DateTime.nowUnsafe()) / millisecondsPerSecond);
}

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(hexRadix).padStart(byteWidth, "0"))
    .join("");
}

function signature(payload: string, secret: string, timestamp: number): Effect.Effect<string> {
  return Effect.promise(() => {
    const encoder = new TextEncoder();
    return crypto.subtle
      .importKey("raw", encoder.encode(secret), { hash: "SHA-256", name: "HMAC" }, false, ["sign"])
      .then((key) => crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${payload}`)))
      .then((digest) => `t=${timestamp},v1=${hex(digest)}`);
  });
}

function deliver(
  app: App,
  event: Readonly<Record<string, unknown>>,
  sign: Readonly<{ secret?: string; timestamp?: number }> = {},
): Effect.Effect<Response> {
  return Effect.gen(function* post() {
    const payload = yield* Schema.encodeEffect(JsonUnknown)(event);
    const header = yield* signature(
      payload,
      sign.secret ?? webhookSecret,
      sign.timestamp ?? nowSeconds(),
    );
    return yield* Effect.promise(() =>
      Promise.resolve(
        app.fetch(
          new Request(`${origin}${apiRoot}/billing/webhook`, {
            body: payload,
            headers: { "content-type": "application/json", "stripe-signature": header },
            method: "POST",
          }),
        ),
      ),
    );
  }).pipe(Effect.orDie);
}

function checkoutCompleted(memberId: string, id = "evt_checkout"): Record<string, unknown> {
  return {
    created: nowSeconds(),
    data: {
      object: {
        client_reference_id: memberId,
        customer: customerId,
        mode: "subscription",
        payment_status: "paid",
        subscription: subscriptionId,
      },
    },
    id,
    type: "checkout.session.completed",
  };
}

function subscriptionEvent(
  type: "customer.subscription.deleted" | "customer.subscription.updated",
  status: string,
  id: string,
  offsetSeconds = 1,
): Record<string, unknown> {
  const created = nowSeconds() + offsetSeconds;
  return {
    created,
    data: {
      object: {
        cancel_at_period_end: false,
        customer: customerId,
        id: subscriptionId,
        items: { data: [{ current_period_end: created + monthInSeconds }] },
        metadata: {},
        status,
      },
    },
    id,
    type,
  };
}

type InvoiceSnapshot = Readonly<{ paid: number; remaining: number; status: string }>;

const openInvoice: InvoiceSnapshot = { paid: 0, remaining: invoiceAmount, status: "open" };
const paidInvoice: InvoiceSnapshot = { paid: invoiceAmount, remaining: 0, status: "paid" };

function invoiceEvent(
  type: "invoice.finalized" | "invoice.paid" | "invoice.payment_failed" | "invoice.updated",
  event: Readonly<{ id: string; offsetSeconds: number; snapshot: InvoiceSnapshot }>,
): Record<string, unknown> {
  return {
    created: nowSeconds() + event.offsetSeconds,
    data: {
      object: {
        amount_due: invoiceAmount,
        amount_paid: event.snapshot.paid,
        amount_remaining: event.snapshot.remaining,
        currency: "jpy",
        customer: customerId,
        hosted_invoice_url: hostedInvoiceUrl,
        id: invoiceId,
        metadata: {},
        status: event.snapshot.status,
        subscription: subscriptionId,
      },
    },
    id: event.id,
    type,
  };
}

function ledgerEvent(
  type: "charge.refunded" | "credit_note.created",
  event: Readonly<{ amount: number; id: string; offsetSeconds: number }>,
): Record<string, unknown> {
  return {
    created: nowSeconds() + event.offsetSeconds,
    data: {
      object:
        type === "credit_note.created"
          ? { amount: event.amount, invoice: invoiceId }
          : { amount_refunded: event.amount, invoice: invoiceId },
    },
    id: event.id,
    type,
  };
}

const quoteId = "qt_test_member";
const quoteCustomerId = "cus_test_company";
const quoteSubscriptionId = "sub_test_company";
const quoteAmount = 120_000;
const netDays = 30;

function quoteEvent(
  type: "quote.accepted" | "quote.canceled" | "quote.finalized",
  event: Readonly<{
    id: string;
    memberId: string | undefined;
    offsetSeconds: number;
    status: string;
  }>,
): Record<string, unknown> {
  const created = nowSeconds() + event.offsetSeconds;
  return {
    created,
    data: {
      object: {
        amount_total: quoteAmount,
        collection_method: "send_invoice",
        currency: "jpy",
        customer: quoteCustomerId,
        expires_at: created + monthInSeconds,
        id: quoteId,
        invoice_settings: { days_until_due: netDays },
        metadata: event.memberId === undefined ? {} : { member_id: event.memberId },
        status: event.status,
        subscription: type === "quote.accepted" ? quoteSubscriptionId : null,
      },
    },
    id: event.id,
    type,
  };
}

const stripeHandlers = [
  http.get(`${stripeApi}/subscriptions/${quoteSubscriptionId}`, () =>
    HttpResponse.json({
      cancel_at_period_end: false,
      customer: quoteCustomerId,
      id: quoteSubscriptionId,
      items: { data: [{ current_period_end: nowSeconds() + monthInSeconds }] },
      metadata: {},
      status: "active",
    }),
  ),
  http.post(`${stripeApi}/checkout/sessions`, ({ request }) =>
    request.formData().then((form) => {
      checkoutForms.push(
        new URLSearchParams([...form].map(([key, value]) => [key, String(value)])),
      );
      return request.headers.get("stripe-version") === stripeApiVersion &&
        form.get("mode") === "subscription" &&
        form.get("line_items[0][price]") === priceId
        ? HttpResponse.json({ url: checkoutUrl })
        : HttpResponse.json({ error: { message: "unexpected checkout form" } }, { status: 400 });
    }),
  ),
  http.post(`${stripeApi}/billing_portal/sessions`, ({ request }) =>
    request
      .formData()
      .then((form) =>
        form.get("customer") === customerId
          ? HttpResponse.json({ url: portalUrl })
          : HttpResponse.json({ error: { message: "unknown customer" } }, { status: 400 }),
      ),
  ),
  http.post(`${stripeApi}/invoiceitems`, ({ request }) =>
    request.formData().then((form) => {
      invoiceKeys.push(String(request.headers.get("idempotency-key")));
      return form.get("customer") === customerId
        ? HttpResponse.json({ id: "ii_test_member" })
        : HttpResponse.json({ error: { message: "unknown customer" } }, { status: 400 });
    }),
  ),
  http.post(`${stripeApi}/invoices`, ({ request }) =>
    request.formData().then((form) => {
      invoiceKeys.push(String(request.headers.get("idempotency-key")));
      return form.get("collection_method") === "send_invoice"
        ? HttpResponse.json({
            amount_due: invoiceAmount,
            amount_remaining: invoiceAmount,
            currency: "jpy",
            id: invoiceId,
            status: "draft",
          })
        : HttpResponse.json({ error: { message: "unexpected invoice form" } }, { status: 400 });
    }),
  ),
  http.post(`${stripeApi}/subscriptions/${subscriptionId}`, ({ request }) =>
    request
      .formData()
      .then((form) =>
        form.get("collection_method") === "send_invoice"
          ? HttpResponse.json({ id: subscriptionId })
          : HttpResponse.json({ error: { message: "unexpected switch" } }, { status: 400 }),
      ),
  ),
  http.get(`${stripeApi}/prices/${priceId}`, () =>
    HttpResponse.json({
      currency: "jpy",
      recurring: { interval: "month", interval_count: 1 },
      unit_amount: invoiceAmount,
    }),
  ),
];

const acceptEverythingPending = Effect.fn("acceptEverythingPending")(
  function* acceptEverythingPending(app: App, client: BrowserClient) {
    const view = yield* Schema.decodeUnknownEffect(AgreementsView)(
      yield* json(yield* call(app, client, "/agreements")),
    );
    return yield* call(app, client, "/agreements/accept", {
      versionIds: view.pending.map((agreement) => agreement.id),
    });
  },
);

const member = Effect.fn("member")(function* member(app: App) {
  const email = "member@example.com";
  yield* registerVerified(email);
  const client = yield* signInAs(APPLICATION.user, email);
  const session = yield* client.verify();
  yield* acceptEverythingPending(app, client);
  return { client, id: session.user.id };
});

describe("billing api", () => {
  const it = authTest;

  it("keeps a free member out of the member list and lets them in once Stripe confirms the checkout", ({
    auth,
  }) =>
    runWith(auth, () =>
      Effect.gen(function* program() {
        (yield* MockNetwork).use(...stripeHandlers);
        const app = billingApp();
        const { client, id } = yield* member(app);
        const refused = yield* call(app, client, "/members?page=1");
        const freePlan = yield* json(yield* call(app, client, "/billing/plan"));
        const started = yield* call(app, client, "/billing/checkout", {});
        const checkout = yield* json(started);
        const applied = yield* deliver(app, checkoutCompleted(id));
        const outcome = yield* json(applied);
        const admitted = yield* call(app, client, "/members?page=1");
        const paidPlan = yield* json(yield* call(app, client, "/billing/plan"));
        const repeated = yield* call(app, client, "/billing/checkout", {});
        return {
          admitted: admitted.status,
          checkout,
          freePlan,
          outcome,
          paidPlan,
          refused: refused.status,
          repeated: repeated.status,
          started: started.status,
        };
      }),
    ).then((result) => {
      expect(result.refused).toBe(httpStatus.paymentRequired);
      expect(result.freePlan).toStrictEqual({ cancelAtPeriodEnd: false, plan: PLAN.free });
      expect(result.started).toBe(httpStatus.ok);
      expect(result.checkout).toStrictEqual({ url: checkoutUrl });
      expect(result.outcome).toStrictEqual({ outcome: WEBHOOK_DISPOSITION.applied });
      expect(result.admitted).toBe(httpStatus.ok);
      expect(result.paidPlan).toStrictEqual({
        cancelAtPeriodEnd: false,
        plan: PLAN.paid,
        status: SUBSCRIPTION_STATUS.active,
      });
      expect(result.repeated).toBe(httpStatus.conflict);
    }));

  it("asks Stripe to calculate tax, collect a tax ID and start a trial when checkout begins", ({
    auth,
  }) =>
    runWith(auth, () =>
      Effect.gen(function* program() {
        (yield* MockNetwork).use(...stripeHandlers);
        const app = billingApp();
        const { client, id } = yield* member(app);
        checkoutForms.length = 0;
        yield* call(app, client, "/billing/checkout", {});
        yield* deliver(app, checkoutCompleted(id));
        yield* deliver(
          app,
          subscriptionEvent("customer.subscription.deleted", "canceled", "evt_gone"),
        );
        yield* call(app, client, "/billing/checkout", {});
        return checkoutForms.map((form) => Object.fromEntries(form));
      }),
    ).then(([first, second]) => {
      expect(first).toMatchObject({
        "automatic_tax[enabled]": "true",
        customer_email: "member@example.com",
        "line_items[1][price]": meteredPriceId,
        "subscription_data[trial_period_days]": String(trialPeriodDays),
        "subscription_data[trial_settings][end_behavior][missing_payment_method]": "cancel",
        "tax_id_collection[enabled]": "true",
      });
      expect(first).not.toHaveProperty("customer_update[address]");
      expect(second).toMatchObject({
        "automatic_tax[enabled]": "true",
        customer: customerId,
        "customer_update[address]": "auto",
        "customer_update[name]": "auto",
      });
      expect(second).not.toHaveProperty("customer_email");
    }));

  it("restores a lapsed subscription once Stripe reports the invoice as paid", ({ auth }) =>
    runWith(auth, () =>
      Effect.gen(function* program() {
        (yield* MockNetwork).use(...stripeHandlers);
        const app = billingApp();
        const { client, id } = yield* member(app);
        yield* deliver(app, checkoutCompleted(id));
        const failed = yield* json(
          yield* deliver(
            app,
            invoiceEvent("invoice.payment_failed", {
              id: "evt_unpaid",
              offsetSeconds: 1,
              snapshot: openInvoice,
            }),
          ),
        );
        const lapsed = yield* call(app, client, "/members?page=1");
        const lapsedPlan = yield* json(yield* call(app, client, "/billing/plan"));
        const settled = yield* json(
          yield* deliver(
            app,
            invoiceEvent("invoice.paid", {
              id: "evt_settled",
              offsetSeconds: 2,
              snapshot: paidInvoice,
            }),
          ),
        );
        const restored = yield* call(app, client, "/members?page=1");
        const restoredPlan = yield* json(yield* call(app, client, "/billing/plan"));
        return {
          failed,
          lapsed: lapsed.status,
          lapsedPlan,
          restored: restored.status,
          restoredPlan,
          settled,
        };
      }),
    ).then((result) => {
      expect(result.failed).toStrictEqual({ outcome: WEBHOOK_DISPOSITION.applied });
      expect(result.lapsed).toBe(httpStatus.paymentRequired);
      expect(result.lapsedPlan).toMatchObject({ status: SUBSCRIPTION_STATUS.pastDue });
      expect(result.settled).toStrictEqual({ outcome: WEBHOOK_DISPOSITION.applied });
      expect(result.restored).toBe(httpStatus.ok);
      expect(result.restoredPlan).toMatchObject({
        plan: PLAN.paid,
        status: SUBSCRIPTION_STATUS.active,
      });
    }));

  it("issues one invoice per switch to invoice payment, keyed so a repeat never bills twice", ({
    auth,
  }) =>
    runWith(auth, () =>
      Effect.gen(function* program() {
        (yield* MockNetwork).use(...stripeHandlers);
        const app = billingApp();
        const { client, id } = yield* member(app);
        yield* deliver(app, checkoutCompleted(id));
        invoiceKeys.length = 0;
        const first = yield* json(yield* call(app, client, "/billing/invoice-payment", {}));
        const repeated = yield* json(yield* call(app, client, "/billing/invoice-payment", {}));
        const listed = yield* json(yield* call(app, client, "/billing/invoices"));
        return { first, keys: [...invoiceKeys], listed, repeated };
      }),
    ).then((result) => {
      expect(result.first).toStrictEqual({ outcome: WEBHOOK_DISPOSITION.applied });
      expect(result.repeated).toStrictEqual({ outcome: WEBHOOK_DISPOSITION.duplicate });
      expect(result.keys).toStrictEqual([
        `subscription-switch:${subscriptionId}:item`,
        `subscription-switch:${subscriptionId}:invoice`,
      ]);
      expect(result.listed).toStrictEqual({
        invoices: [
          {
            amountCredited: 0,
            amountDue: invoiceAmount,
            amountPaid: 0,
            amountRefunded: 0,
            amountRemaining: invoiceAmount,
            currency: "jpy",
            issuedAt: expect.any(String),
            status: "draft",
            stripeInvoiceId: invoiceId,
          },
        ],
      });
    }));

  it("keeps the ledger on Stripe's own figures through a credit note, payment and refund", ({
    auth,
  }) =>
    runWith(auth, () =>
      Effect.gen(function* program() {
        (yield* MockNetwork).use(...stripeHandlers);
        const app = billingApp();
        const { client, id } = yield* member(app);
        yield* deliver(app, checkoutCompleted(id));
        yield* deliver(
          app,
          invoiceEvent("invoice.finalized", {
            id: "evt_finalized",
            offsetSeconds: 1,
            snapshot: openInvoice,
          }),
        );
        yield* deliver(
          app,
          ledgerEvent("credit_note.created", { amount: 200, id: "evt_credit", offsetSeconds: 4 }),
        );
        yield* deliver(
          app,
          invoiceEvent("invoice.updated", {
            id: "evt_credited",
            offsetSeconds: 3,
            snapshot: { paid: 0, remaining: invoiceAmount - 200, status: "open" },
          }),
        );
        const creditedInvoices = yield* json(yield* call(app, client, "/billing/invoices"));
        yield* deliver(
          app,
          invoiceEvent("invoice.paid", {
            id: "evt_paid",
            offsetSeconds: 5,
            snapshot: { paid: invoiceAmount - 200, remaining: 0, status: "paid" },
          }),
        );
        yield* deliver(
          app,
          ledgerEvent("charge.refunded", { amount: 300, id: "evt_refund", offsetSeconds: 6 }),
        );
        const settledInvoices = yield* json(yield* call(app, client, "/billing/invoices"));
        return { creditedInvoices, settledInvoices };
      }),
    ).then((result) => {
      expect(result.creditedInvoices).toStrictEqual({
        invoices: [
          {
            amountCredited: 200,
            amountDue: invoiceAmount,
            amountPaid: 0,
            amountRefunded: 0,
            amountRemaining: invoiceAmount - 200,
            currency: "jpy",
            hostedInvoiceUrl,
            issuedAt: expect.any(String),
            status: "open",
            stripeInvoiceId: invoiceId,
          },
        ],
      });
      expect(result.settledInvoices).toStrictEqual({
        invoices: [
          {
            amountCredited: 200,
            amountDue: invoiceAmount,
            amountPaid: invoiceAmount - 200,
            amountRefunded: 300,
            amountRemaining: 0,
            currency: "jpy",
            hostedInvoiceUrl,
            issuedAt: expect.any(String),
            status: "paid",
            stripeInvoiceId: invoiceId,
          },
        ],
      });
    }));

  it("turns an accepted sales quote into the member's paid plan, billed by invoice", ({ auth }) =>
    runWith(auth, () =>
      Effect.gen(function* program() {
        (yield* MockNetwork).use(...stripeHandlers);
        const app = billingApp();
        const { client, id } = yield* member(app);
        yield* deliver(
          app,
          quoteEvent("quote.finalized", {
            id: "evt_quote_open",
            memberId: id,
            offsetSeconds: 1,
            status: "open",
          }),
        );
        const offered = yield* json(yield* call(app, client, "/billing/quotes"));
        const beforeAcceptance = yield* call(app, client, "/members?page=1");
        const accepted = yield* json(
          yield* deliver(
            app,
            quoteEvent("quote.accepted", {
              id: "evt_quote_accepted",
              memberId: id,
              offsetSeconds: 2,
              status: "accepted",
            }),
          ),
        );
        const afterAcceptance = yield* call(app, client, "/members?page=1");
        const plan = yield* json(yield* call(app, client, "/billing/plan"));
        const settled = yield* Schema.decodeUnknownEffect(QuoteList)(
          yield* json(yield* call(app, client, "/billing/quotes")),
        );
        return {
          accepted,
          afterAcceptance: afterAcceptance.status,
          beforeAcceptance: beforeAcceptance.status,
          offered,
          plan,
          settledStatuses: settled.quotes.map((quote) => quote.status),
        };
      }),
    ).then((result) => {
      expect(result.offered).toStrictEqual({
        quotes: [
          {
            amountTotal: quoteAmount,
            collectionMethod: "send_invoice",
            currency: "jpy",
            daysUntilDue: netDays,
            expiresAt: expect.any(String),
            status: "open",
            stripeQuoteId: quoteId,
          },
        ],
      });
      expect(result.beforeAcceptance).toBe(httpStatus.paymentRequired);
      expect(result.accepted).toStrictEqual({ outcome: WEBHOOK_DISPOSITION.applied });
      expect(result.afterAcceptance).toBe(httpStatus.ok);
      expect(result.plan).toMatchObject({ plan: PLAN.paid, status: SUBSCRIPTION_STATUS.active });
      expect(result.settledStatuses).toStrictEqual(["accepted"]);
    }));

  it("records a canceled quote and ignores one that names no member", ({ auth }) =>
    runWith(auth, () =>
      Effect.gen(function* program() {
        (yield* MockNetwork).use(...stripeHandlers);
        const app = billingApp();
        const { client, id } = yield* member(app);
        const unowned = yield* json(
          yield* deliver(
            app,
            quoteEvent("quote.finalized", {
              id: "evt_quote_unowned",
              memberId: undefined,
              offsetSeconds: 1,
              status: "open",
            }),
          ),
        );
        yield* deliver(
          app,
          quoteEvent("quote.finalized", {
            id: "evt_quote_open",
            memberId: id,
            offsetSeconds: 2,
            status: "open",
          }),
        );
        yield* deliver(
          app,
          quoteEvent("quote.canceled", {
            id: "evt_quote_canceled",
            memberId: id,
            offsetSeconds: 3,
            status: "canceled",
          }),
        );
        const listed = yield* Schema.decodeUnknownEffect(QuoteList)(
          yield* json(yield* call(app, client, "/billing/quotes")),
        );
        return { statuses: listed.quotes.map((quote) => quote.status), unowned };
      }),
    ).then((result) => {
      expect(result.unowned).toStrictEqual({ outcome: WEBHOOK_DISPOSITION.ignored });
      expect(result.statuses).toStrictEqual(["canceled"]);
    }));

  it("adds up every credit note on an invoice instead of keeping only the last one", ({ auth }) =>
    runWith(auth, () =>
      Effect.gen(function* program() {
        (yield* MockNetwork).use(...stripeHandlers);
        const app = billingApp();
        const { client, id } = yield* member(app);
        yield* deliver(app, checkoutCompleted(id));
        yield* deliver(
          app,
          invoiceEvent("invoice.finalized", {
            id: "evt_finalized",
            offsetSeconds: 1,
            snapshot: openInvoice,
          }),
        );
        yield* deliver(
          app,
          ledgerEvent("credit_note.created", { amount: 100, id: "evt_credit_1", offsetSeconds: 2 }),
        );
        yield* deliver(
          app,
          ledgerEvent("credit_note.created", { amount: 150, id: "evt_credit_2", offsetSeconds: 3 }),
        );
        yield* deliver(
          app,
          ledgerEvent("credit_note.created", { amount: 150, id: "evt_credit_2", offsetSeconds: 3 }),
        );
        return yield* Schema.decodeUnknownEffect(InvoiceList)(
          yield* json(yield* call(app, client, "/billing/invoices")),
        );
      }),
    ).then((listed) => {
      expect(listed.invoices.map((invoice) => invoice.amountCredited)).toStrictEqual([250]);
    }));

  it("treats a replayed event as a no-op and drops the member back to free when the subscription ends", ({
    auth,
  }) =>
    runWith(auth, () =>
      Effect.gen(function* program() {
        (yield* MockNetwork).use(...stripeHandlers);
        const app = billingApp();
        const { client, id } = yield* member(app);
        yield* deliver(app, checkoutCompleted(id));
        const replayed = yield* json(yield* deliver(app, checkoutCompleted(id)));
        const stillPaid = yield* call(app, client, "/members?page=1");
        const portal = yield* json(yield* call(app, client, "/billing/portal", {}));
        const deleted = yield* json(
          yield* deliver(
            app,
            subscriptionEvent("customer.subscription.deleted", "canceled", "evt_deleted"),
          ),
        );
        const refusedAgain = yield* call(app, client, "/members?page=1");
        const lapsedPlan = yield* json(yield* call(app, client, "/billing/plan"));
        return {
          deleted,
          lapsedPlan,
          portal,
          refusedAgain: refusedAgain.status,
          replayed,
          stillPaid: stillPaid.status,
        };
      }),
    ).then((result) => {
      expect(result.replayed).toStrictEqual({ outcome: WEBHOOK_DISPOSITION.duplicate });
      expect(result.stillPaid).toBe(httpStatus.ok);
      expect(result.portal).toStrictEqual({ url: portalUrl });
      expect(result.deleted).toStrictEqual({ outcome: WEBHOOK_DISPOSITION.applied });
      expect(result.refusedAgain).toBe(httpStatus.paymentRequired);
      expect(result.lapsedPlan).toMatchObject({
        plan: PLAN.free,
        status: SUBSCRIPTION_STATUS.canceled,
      });
    }));

  it("rejects webhooks whose signature is wrong, stale or missing without touching the plan", ({
    auth,
  }) =>
    runWith(auth, () =>
      Effect.gen(function* program() {
        (yield* MockNetwork).use(...stripeHandlers);
        const app = billingApp();
        const { client, id } = yield* member(app);
        const forged = yield* deliver(app, checkoutCompleted(id), { secret: "whsec_forged" });
        const stale = yield* deliver(app, checkoutCompleted(id), {
          timestamp: nowSeconds() - 2 * 60 * 60,
        });
        const payload = yield* Schema.encodeEffect(JsonUnknown)(checkoutCompleted(id));
        const unsigned = yield* Effect.promise(() =>
          Promise.resolve(
            app.fetch(
              new Request(`${origin}${apiRoot}/billing/webhook`, {
                body: payload,
                headers: { "content-type": "application/json" },
                method: "POST",
              }),
            ),
          ),
        );
        const stillRefused = yield* call(app, client, "/members?page=1");
        return {
          forged: forged.status,
          stale: stale.status,
          stillRefused: stillRefused.status,
          unsigned: unsigned.status,
        };
      }),
    ).then((result) => {
      expect(result.forged).toBe(httpStatus.badRequest);
      expect(result.stale).toBe(httpStatus.badRequest);
      expect(result.unsigned).toBe(httpStatus.badRequest);
      expect(result.stillRefused).toBe(httpStatus.paymentRequired);
    }));

  it("refuses the portal to a member who never checked out and the offer to a visitor", ({
    auth,
  }) =>
    runWith(auth, () =>
      Effect.gen(function* program() {
        (yield* MockNetwork).use(...stripeHandlers);
        const app = billingApp();
        const { client } = yield* member(app);
        const portal = yield* call(app, client, "/billing/portal", {});
        const offer = yield* json(yield* call(app, client, "/billing/offer"));
        const visitor = yield* Effect.promise(() =>
          Promise.resolve(app.fetch(new Request(`${origin}${apiRoot}/billing/offer`))),
        );
        return { offer, portal: portal.status, visitor: visitor.status };
      }),
    ).then((result) => {
      expect(result.portal).toBe(httpStatus.paymentRequired);
      expect(result.offer).toStrictEqual({
        currency: "jpy",
        interval: "month",
        intervalCount: 1,
        unitAmount: 980,
      });
      expect(result.visitor).toBe(httpStatus.unauthorized);
    }));
});
