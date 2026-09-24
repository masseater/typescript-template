import { Schema } from "effect";

class StripeSignatureInvalid extends Schema.TaggedError<StripeSignatureInvalid>()(
  "StripeSignatureInvalid",
  { reason: Schema.Literals(["header_malformed", "mismatch", "stale"]) },
) {}

export { StripeSignatureInvalid };
