import { applyStripeWebhookEvent } from "@repo/db";
import { Effect } from "effect";

import type { StripeEvent } from "./stripe.ts";

const handleStripeEvent = Effect.fn("handleStripeEvent")(function* handleStripeEvent(
  event: StripeEvent,
) {
  return yield* applyStripeWebhookEvent(event);
});

export { handleStripeEvent };
