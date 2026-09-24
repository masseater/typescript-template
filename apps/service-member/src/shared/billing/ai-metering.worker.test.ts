import { assert, it } from "@effect/vitest";
import { setupNetwork } from "@msw/cloudflare";
import { aiUsageSince } from "@repo/db";
import { TestDatabase, runStatement } from "@repo/db/testing";
import { appEnvironment } from "@repo/runtime/testing";
import { DateTime, Effect, Layer } from "effect";
import { TestClock } from "effect/testing";
import { HttpResponse, http } from "msw";

import { meterAiTurn } from "./ai-metering.ts";
import { Stripe } from "./stripe.ts";

import type { Scope } from "effect";

const meterEvents = "https://api.stripe.com/v1/billing/meter_events";
const customerId = "cus_metered_member";
const epoch = DateTime.toDate(DateTime.makeUnsafe(0));

const stripeLayer = Layer.orDie(Stripe.fromEnvironment(appEnvironment()));

function addMember(id: string): Effect.Effect<unknown, unknown> {
  return runStatement(
    "INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 1, 0, 0)",
    id,
    id,
    `${id}@example.com`,
  );
}

function subscribe(id: string): Effect.Effect<unknown, unknown> {
  return runStatement(
    "INSERT INTO plan_subscription (cancel_at_period_end, current_period_end, member_id, status, stripe_customer_id, stripe_subscription_id, updated_at) VALUES (0, NULL, ?, 'active', ?, ?, 0)",
    id,
    customerId,
    `sub_${id}`,
  );
}

function stripeAnswering(
  statuses: readonly number[],
  sent: URLSearchParams[],
): Effect.Effect<void, never, Scope.Scope> {
  return Effect.acquireRelease(
    Effect.sync(() => {
      const network = setupNetwork();
      network.configure({ onUnhandledFrame: "error" });
      network.use(
        http.post(meterEvents, ({ request }) =>
          request.formData().then((form) => {
            const status = statuses[Math.min(sent.length, statuses.length - 1)] ?? 200;
            sent.push(new URLSearchParams([...form].map(([key, value]) => [key, String(value)])));
            return status === 200
              ? HttpResponse.json({ event_name: "ai_interview_turn" })
              : HttpResponse.json({ error: { message: "unavailable" } }, { status });
          }),
        ),
      );
      network.enable();
      return network;
    }),
    (network) =>
      Effect.sync(() => {
        network.disable();
      }),
  ).pipe(Effect.asVoid);
}

function withStripeAnswering<Value, Failure, Requirement>(
  statuses: readonly number[],
  sent: URLSearchParams[],
  program: Effect.Effect<Value, Failure, Requirement>,
) {
  return stripeAnswering(statuses, sent).pipe(
    Effect.andThen(program.pipe(Effect.provide(stripeLayer))),
  );
}

it.effect("a paid member's model turn reaches the meter once, however often it is replayed", () =>
  Effect.gen(function* program() {
    const sent: URLSearchParams[] = [];
    yield* addMember("member");
    yield* subscribe("member");
    yield* withStripeAnswering(
      [200],
      sent,
      Effect.gen(function* replayTwice() {
        yield* meterAiTurn({ identifier: "interview:member:1", memberId: "member" });
        yield* meterAiTurn({ identifier: "interview:member:1", memberId: "member" });
      }),
    );
    const usage = yield* aiUsageSince({ memberId: "member", since: epoch });
    assert.deepStrictEqual(
      sent.map((form) => Object.fromEntries(form)),
      [
        {
          event_name: "ai_interview_turn",
          identifier: "interview:member:1",
          "payload[stripe_customer_id]": customerId,
          "payload[value]": "1",
          timestamp: "0",
        },
      ],
    );
    assert.deepStrictEqual(usage, { events: 1, quantity: 1, unreported: 0 });
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("usage that Stripe refused stays on record as unreported instead of vanishing", () =>
  Effect.gen(function* program() {
    const sent: URLSearchParams[] = [];
    yield* addMember("member");
    yield* subscribe("member");
    const metered = yield* withStripeAnswering(
      [503],
      sent,
      meterAiTurn({ identifier: "interview:member:1", memberId: "member" }),
    );
    const usage = yield* aiUsageSince({ memberId: "member", since: epoch });
    assert.strictEqual(sent.length, 1);
    assert.deepStrictEqual(metered, { unreported: 1 });
    assert.deepStrictEqual(usage, { events: 1, quantity: 1, unreported: 1 });
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("refused usage reaches the meter on the next turn, stamped with when it happened", () =>
  Effect.gen(function* program() {
    const sent: URLSearchParams[] = [];
    yield* addMember("member");
    yield* subscribe("member");
    const metered = yield* withStripeAnswering(
      [503, 200],
      sent,
      Effect.gen(function* twoTurnsAnHourApart() {
        yield* meterAiTurn({ identifier: "interview:member:1", memberId: "member" });
        yield* TestClock.adjust("1 hour");
        return yield* meterAiTurn({ identifier: "interview:member:2", memberId: "member" });
      }),
    );
    const usage = yield* aiUsageSince({ memberId: "member", since: epoch });
    assert.deepStrictEqual(
      sent.map((form) => [form.get("identifier"), form.get("timestamp")]),
      [
        ["interview:member:1", "0"],
        ["interview:member:1", "0"],
        ["interview:member:2", "3600"],
      ],
    );
    assert.deepStrictEqual(metered, { unreported: 0 });
    assert.deepStrictEqual(usage, { events: 2, quantity: 2, unreported: 0 });
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("a free member's turn is neither recorded nor sent", () =>
  Effect.gen(function* program() {
    const sent: URLSearchParams[] = [];
    yield* addMember("member");
    yield* withStripeAnswering(
      [200],
      sent,
      meterAiTurn({ identifier: "interview:member:1", memberId: "member" }),
    );
    const usage = yield* aiUsageSince({ memberId: "member", since: epoch });
    assert.strictEqual(sent.length, 0);
    assert.deepStrictEqual(usage, { events: 0, quantity: 0, unreported: 0 });
  }).pipe(Effect.provide(TestDatabase)),
);
