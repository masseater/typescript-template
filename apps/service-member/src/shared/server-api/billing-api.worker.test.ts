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

import { AgreementsView } from "#shared/contracts/index.ts";
import { memberApi } from "./member-api.ts";
import { memberRequirementLayer } from "./member-requirement-layer.ts";

import type { BrowserClient } from "@repo/auth/testing";

type App = ReturnType<typeof billingApp>;

const origin = origins[APPLICATION.user];
const stripeApi = "https://api.stripe.com/v1";
const priceId = "price_TestMonthly";
const webhookSecret = "whsec_testsecret";
const checkoutUrl = "https://checkout.stripe.com/c/pay/cs_test_session";
const portalUrl = "https://billing.stripe.com/p/session/test_portal";
const customerId = "cus_test_member";
const subscriptionId = "sub_test_member";
const trialPeriodDays = 14;
const checkoutForms: URLSearchParams[] = [];
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
    STRIPE_AUTOMATIC_TAX: "true",
    STRIPE_PRICE_ID: priceId,
    STRIPE_SECRET_KEY: "sk_test_placeholder",
    STRIPE_TRIAL_PERIOD_DAYS: String(trialPeriodDays),
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

function invoiceEvent(
  type: "invoice.paid" | "invoice.payment_failed",
  id: string,
  offsetSeconds: number,
): Record<string, unknown> {
  return {
    created: nowSeconds() + offsetSeconds,
    data: { object: { subscription: subscriptionId } },
    id,
    type,
  };
}

const stripeHandlers = [
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
  http.get(`${stripeApi}/prices/${priceId}`, () =>
    HttpResponse.json({
      currency: "jpy",
      recurring: { interval: "month", interval_count: 1 },
      unit_amount: 980,
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
          yield* deliver(app, invoiceEvent("invoice.payment_failed", "evt_unpaid", 1)),
        );
        const lapsed = yield* call(app, client, "/members?page=1");
        const lapsedPlan = yield* json(yield* call(app, client, "/billing/plan"));
        const settled = yield* json(
          yield* deliver(app, invoiceEvent("invoice.paid", "evt_settled", 2)),
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
