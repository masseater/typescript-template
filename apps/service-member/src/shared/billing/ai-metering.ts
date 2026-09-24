import { findSubscription, markAiUsageReported, recordAiUsage, unreportedAiUsage } from "@repo/db";
import { logCause } from "@repo/observability";
import { Cause, DateTime, Effect } from "effect";

import { Stripe } from "./stripe.ts";

const oneTurn = 1;
const meterBackdatingLimit = { days: 35 } as const;

const meterAiTurn = Effect.fn("billing.meterAiTurn")(function* meterAiTurn(
  turn: Readonly<{ identifier: string; memberId: string }>,
) {
  const subscription = yield* findSubscription(turn.memberId);
  if (subscription === undefined) {
    return { unreported: 0 };
  }
  yield* recordAiUsage({
    identifier: turn.identifier,
    memberId: turn.memberId,
    quantity: oneTurn,
  });
  const pending = {
    memberId: turn.memberId,
    since: DateTime.toDate(DateTime.subtract(yield* DateTime.now, meterBackdatingLimit)),
  };
  const stripe = yield* Stripe;
  yield* Effect.forEach(
    yield* unreportedAiUsage(pending),
    (usage) =>
      stripe
        .reportUsage({
          customerId: subscription.stripeCustomerId,
          identifier: usage.identifier,
          occurredAt: usage.occurredAt,
          quantity: usage.quantity,
        })
        .pipe(Effect.andThen(markAiUsageReported(usage.identifier))),
    { discard: true },
  ).pipe(
    Effect.catchTag("StripeFailure", (failure) =>
      logCause({
        attributes: { identifier: turn.identifier, reason: failure.reason },
        cause: Cause.fail(failure),
        eventName: "billing.usage_unreported",
      }),
    ),
  );
  return { unreported: (yield* unreportedAiUsage(pending)).length };
});

export { meterAiTurn };
