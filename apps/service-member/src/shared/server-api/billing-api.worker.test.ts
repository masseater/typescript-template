import {
  MockNetwork,
  authTest,
  authTestSecret,
  origins,
  registerVerified,
  runWith,
  signInAs,
} from "@repo/auth/testing";
import { APPLICATION, PLAN, SUBSCRIPTION_STATUS, WEBHOOK_OUTCOME } from "@repo/config";
import { httpStatus } from "@repo/observability";
import { recordingSink } from "@repo/observability/testing";
import { appLayer } from "@repo/runtime/bindings";
import { apiRoot, apiRoutes } from "@repo/runtime/http";
import { appEnvironment } from "@repo/runtime/testing";
import { workerRuntime } from "@repo/runtime/worker";
import { Effect, Layer } from "effect";
import { HttpResponse, http } from "msw";
import { describe, expect } from "vite-plus/test";

import { Stripe } from "#shared/billing/index.ts";
import { memberApi } from "./member-api.ts";

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
const millisecondsPerSecond = 1000;
const monthInSeconds = 30 * 24 * 60 * 60;
const hexRadix = 16;
const byteWidth = 2;

const routes = { "/api/billing/*": "billing-api", "/api/members": "members-api" };
const reporting = { log: recordingSink().sink, service: APPLICATION.user } as const;

function billingApp() {
  const environment = appEnvironment({
    APP_ORIGIN: origin,
    AUTH_SECRET: authTestSecret,
    STRIPE_PRICE_ID: priceId,
    STRIPE_SECRET_KEY: "sk_test_placeholder",
    STRIPE_WEBHOOK_SECRET: webhookSecret,
  });
  const runtime = workerRuntime(() =>
    Layer.merge(
      Layer.orDie(appLayer(environment, APPLICATION.user, routes)),
      Layer.orDie(Stripe.fromEnvironment(environment)),
    ),
  );
  const api = apiRoutes(runtime, reporting);
  return memberApi(api);
}

function call(
  app: App,
  client: BrowserClient,
  path: string,
  body?: unknown,
): Effect.Effect<Response> {
  return Effect.promise(async () =>
    app.fetch(
      new Request(`${origin}${apiRoot}${path}`, {
        headers: {
          ...Object.fromEntries(client.cookieHeaders()),
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        method: body === undefined ? "GET" : "POST",
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    ),
  );
}

function json(response: Response): Effect.Effect<unknown> {
  return Effect.promise(async (): Promise<unknown> => response.json());
}

function nowSeconds(): number {
  return Math.floor(Date.now() / millisecondsPerSecond);
}

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(hexRadix).padStart(byteWidth, "0"))
    .join("");
}

function signature(payload: string, secret: string, timestamp: number): Effect.Effect<string> {
  return Effect.promise(async () => {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { hash: "SHA-256", name: "HMAC" },
      false,
      ["sign"],
    );
    const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${payload}`));
    return `t=${timestamp},v1=${hex(digest)}`;
  });
}

function deliver(
  app: App,
  event: Readonly<Record<string, unknown>>,
  sign: Readonly<{ secret?: string; timestamp?: number }> = {},
): Effect.Effect<Response> {
  const payload = JSON.stringify(event);
  return Effect.gen(function* post() {
    const header = yield* signature(
      payload,
      sign.secret ?? webhookSecret,
      sign.timestamp ?? nowSeconds(),
    );
    return yield* Effect.promise(async () =>
      app.fetch(
        new Request(`${origin}${apiRoot}/billing/webhook`, {
          body: payload,
          headers: { "content-type": "application/json", "stripe-signature": header },
          method: "POST",
        }),
      ),
    );
  });
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

const stripeHandlers = [
  http.post(`${stripeApi}/checkout/sessions`, async ({ request }) => {
    const form = await request.formData();
    return form.get("mode") === "subscription" && form.get("line_items[0][price]") === priceId
      ? HttpResponse.json({ url: checkoutUrl })
      : HttpResponse.json({ error: { message: "unexpected checkout form" } }, { status: 400 });
  }),
  http.post(`${stripeApi}/billing_portal/sessions`, async ({ request }) => {
    const form = await request.formData();
    return form.get("customer") === customerId
      ? HttpResponse.json({ url: portalUrl })
      : HttpResponse.json({ error: { message: "unknown customer" } }, { status: 400 });
  }),
  http.get(`${stripeApi}/prices/${priceId}`, () =>
    HttpResponse.json({
      currency: "jpy",
      recurring: { interval: "month", interval_count: 1 },
      unit_amount: 980,
    }),
  ),
];

const member = Effect.fn("member")(function* member() {
  const email = "member@example.com";
  yield* registerVerified(email);
  const client = yield* signInAs(APPLICATION.user, email);
  const session = yield* client.verify();
  return { client, id: session.user.id };
});

describe("billing api", () => {
  const it = authTest();

  it("keeps a free member out of the member list and lets them in once Stripe confirms the checkout", async ({
    auth,
  }) => {
    const result = await runWith(auth, () =>
      Effect.gen(function* program() {
        (yield* MockNetwork).use(...stripeHandlers);
        const app = billingApp();
        const { client, id } = yield* member();
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
    );
    expect(result.refused).toBe(httpStatus.paymentRequired);
    expect(result.freePlan).toStrictEqual({ cancelAtPeriodEnd: false, plan: PLAN.free });
    expect(result.started).toBe(httpStatus.ok);
    expect(result.checkout).toStrictEqual({ url: checkoutUrl });
    expect(result.outcome).toStrictEqual({ outcome: WEBHOOK_OUTCOME.applied });
    expect(result.admitted).toBe(httpStatus.ok);
    expect(result.paidPlan).toStrictEqual({
      cancelAtPeriodEnd: false,
      plan: PLAN.paid,
      status: SUBSCRIPTION_STATUS.active,
    });
    expect(result.repeated).toBe(httpStatus.conflict);
  });

  it("treats a replayed event as a no-op and drops the member back to free when the subscription ends", async ({
    auth,
  }) => {
    const result = await runWith(auth, () =>
      Effect.gen(function* program() {
        (yield* MockNetwork).use(...stripeHandlers);
        const app = billingApp();
        const { client, id } = yield* member();
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
    );
    expect(result.replayed).toStrictEqual({ outcome: WEBHOOK_OUTCOME.duplicate });
    expect(result.stillPaid).toBe(httpStatus.ok);
    expect(result.portal).toStrictEqual({ url: portalUrl });
    expect(result.deleted).toStrictEqual({ outcome: WEBHOOK_OUTCOME.applied });
    expect(result.refusedAgain).toBe(httpStatus.paymentRequired);
    expect(result.lapsedPlan).toMatchObject({
      plan: PLAN.free,
      status: SUBSCRIPTION_STATUS.canceled,
    });
  });

  it("rejects webhooks whose signature is wrong, stale or missing without touching the plan", async ({
    auth,
  }) => {
    const result = await runWith(auth, () =>
      Effect.gen(function* program() {
        (yield* MockNetwork).use(...stripeHandlers);
        const app = billingApp();
        const { client, id } = yield* member();
        const forged = yield* deliver(app, checkoutCompleted(id), { secret: "whsec_forged" });
        const stale = yield* deliver(app, checkoutCompleted(id), {
          timestamp: nowSeconds() - 2 * 60 * 60,
        });
        const unsigned = yield* Effect.promise(async () =>
          app.fetch(
            new Request(`${origin}${apiRoot}/billing/webhook`, {
              body: JSON.stringify(checkoutCompleted(id)),
              headers: { "content-type": "application/json" },
              method: "POST",
            }),
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
    );
    expect(result.forged).toBe(httpStatus.badRequest);
    expect(result.stale).toBe(httpStatus.badRequest);
    expect(result.unsigned).toBe(httpStatus.badRequest);
    expect(result.stillRefused).toBe(httpStatus.paymentRequired);
  });

  it("refuses the portal to a member who never checked out and the offer to a visitor", async ({
    auth,
  }) => {
    const result = await runWith(auth, () =>
      Effect.gen(function* program() {
        (yield* MockNetwork).use(...stripeHandlers);
        const app = billingApp();
        const { client } = yield* member();
        const portal = yield* call(app, client, "/billing/portal", {});
        const offer = yield* json(yield* call(app, client, "/billing/offer"));
        const visitor = yield* Effect.promise(async () =>
          app.fetch(new Request(`${origin}${apiRoot}/billing/offer`)),
        );
        return { offer, portal: portal.status, visitor: visitor.status };
      }),
    );
    expect(result.portal).toBe(httpStatus.paymentRequired);
    expect(result.offer).toStrictEqual({
      currency: "jpy",
      interval: "month",
      intervalCount: 1,
      unitAmount: 980,
    });
    expect(result.visitor).toBe(httpStatus.unauthorized);
  });
});
