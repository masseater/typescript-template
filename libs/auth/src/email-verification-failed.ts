import { Schema } from "effect";

class EmailVerificationFailed extends Schema.TaggedError<EmailVerificationFailed>()(
  "EmailVerificationFailed",
  { rateLimited: Schema.Boolean },
) {}

export { EmailVerificationFailed };
