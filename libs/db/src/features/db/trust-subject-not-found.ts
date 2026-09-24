import { Schema } from "effect";

class TrustSubjectNotFound extends Schema.TaggedError<TrustSubjectNotFound>()(
  "TrustSubjectNotFound",
  {},
) {}

export { TrustSubjectNotFound };
