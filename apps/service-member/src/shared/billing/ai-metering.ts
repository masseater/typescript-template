import { findSubscription, markAiUsageReported, recordAiUsage } from "@repo/db";
import { logAt } from "@repo/observability";
import { Effect } from "effect";

import { Stripe } from "./stripe.ts";

const oneTurn = 1;

const meterAiTurn = Effect.fn("billing.meterAiTurn")(function* meterAiTurn(
  turn: Readonly<{ identifier: string; memberId: string }>,
) {
  const subscription = yield* findSubscription(turn.memberId);
  if (subscription === undefined) {
    return;
  }
  const first = yield* recordAiUsage({
    identifier: turn.identifier,
    memberId: turn.memberId,
    quantity: oneTurn,
  });
  if (!first) {
    return;
  }
  yield* (yield* Stripe)
    .reportUsage({
      customerId: subscription.stripeCustomerId,
      identifier: turn.identifier,
      quantity: oneTurn,
    })
    .pipe(
      Effect.flatMap(() => markAiUsageReported(turn.identifier)),
      Effect.catchTag("StripeFailure", (failure) =>
        logAt("Warn", {
          attributes: { identifier: turn.identifier, reason: failure.reason },
          eventName: "billing.usage_unreported",
        }),
      ),
    );
});

export { meterAiTurn };
