import { Schema } from "effect";

class AgreementWithdrawalUnavailable extends Schema.TaggedError<AgreementWithdrawalUnavailable>()(
  "AgreementWithdrawalUnavailable",
  {},
) {}

export { AgreementWithdrawalUnavailable };
