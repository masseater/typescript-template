import { Schema } from "effect";

class VerifyCommandFailure extends Schema.TaggedError<VerifyCommandFailure>()(
  "VerifyCommandFailure",
  {
    reason: Schema.Literals([
      "command_unsupported",
      "credentials_invalid",
      "browser_start_failed",
      "browser_authentication_failed",
    ]),
  },
) {}

const failure = (reason: VerifyCommandFailure["reason"]): VerifyCommandFailure => {
  return new VerifyCommandFailure({ reason });
};

export { failure };
export type { VerifyCommandFailure };
