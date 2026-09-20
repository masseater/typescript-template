import { Schema } from "effect";

class InviteRejected extends Schema.TaggedError<InviteRejected>()("InviteRejected", {
  reason: Schema.Literals(["missing", "pending", "permission", "registered"]),
}) {}

export { InviteRejected };
