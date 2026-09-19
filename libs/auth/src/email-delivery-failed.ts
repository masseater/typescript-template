import { Schema } from "effect";

class EmailDeliveryFailed extends Schema.TaggedError<EmailDeliveryFailed>()("EmailDeliveryFailed", {
  cause: Schema.optionalKey(Schema.Defect()),
  reason: Schema.Literals(["rejected", "unreachable"]),
}) {}

export { EmailDeliveryFailed };
