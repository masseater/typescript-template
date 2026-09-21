import { Schema } from "effect";

class StripeFailure extends Schema.TaggedError<StripeFailure>()("StripeFailure", {
  cause: Schema.optionalKey(Schema.Defect()),
  reason: Schema.Literals(["request_failed", "response_invalid", "timed_out"]),
  status: Schema.optionalKey(Schema.Number),
}) {}

export { StripeFailure };
