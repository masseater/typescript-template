import { Schema } from "effect";

class StripeEventUnreadable extends Schema.TaggedError<StripeEventUnreadable>()(
  "StripeEventUnreadable",
  {},
) {}

export { StripeEventUnreadable };
