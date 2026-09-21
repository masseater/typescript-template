import { Schema } from "effect";

class AgreementVersionUnavailable extends Schema.TaggedError<AgreementVersionUnavailable>()(
  "AgreementVersionUnavailable",
  {},
) {}

export { AgreementVersionUnavailable };
