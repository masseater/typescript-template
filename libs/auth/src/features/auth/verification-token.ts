import { Encoding, Result, Schema } from "effect";

class VerificationTokenInvalid extends Schema.TaggedError<VerificationTokenInvalid>()(
  "VerificationTokenInvalid",
  {},
) {}

const VerificationClaims = Schema.Struct({ updateTo: Schema.optional(Schema.String) });

const decodeClaims = Schema.decodeUnknownResult(Schema.fromJsonString(VerificationClaims));

const emailChangeTarget = (
  token: string,
): Result.Result<string | undefined, VerificationTokenInvalid> => {
  const [, claims] = token.split(".");
  if (claims === undefined) {
    return Result.fail(new VerificationTokenInvalid());
  }
  const decoded = Result.flatMap(Encoding.decodeBase64UrlString(claims), decodeClaims);
  if (Result.isFailure(decoded)) {
    return Result.fail(new VerificationTokenInvalid());
  }
  return Result.succeed(decoded.success.updateTo);
};

export { emailChangeTarget };
