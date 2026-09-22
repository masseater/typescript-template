import { agreementKinds } from "@repo/config";
import { Schema } from "effect";

class AgreementRequired extends Schema.TaggedError<AgreementRequired>()("AgreementRequired", {
  kinds: Schema.Array(Schema.Literals(agreementKinds)),
}) {}

export { AgreementRequired };
