import { Schema } from "effect";

class EmailDeliveryFailed extends Schema.TaggedError<EmailDeliveryFailed>()("EmailDeliveryFailed", {
  reason: Schema.Literals(["origin_mismatch", "rejected", "unreachable"]),
}) {}

export { EmailDeliveryFailed };
