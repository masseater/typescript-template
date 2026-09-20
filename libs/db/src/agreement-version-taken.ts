import { Schema } from "effect";

class AgreementVersionTaken extends Schema.TaggedError<AgreementVersionTaken>()(
  "AgreementVersionTaken",
  {},
) {}

export { AgreementVersionTaken };
