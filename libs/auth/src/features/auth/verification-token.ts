import { Encoding, Result, Schema } from "effect";

class VerificationTokenInvalid extends Schema.TaggedError<VerificationTokenInvalid>()(
  "VerificationTokenInvalid",
  {},
) {}

const VerificationClaims = Schema.Struct({
  email: Schema.optional(Schema.String),
  updateTo: Schema.optional(Schema.String),
});

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

const emailChangePrevious = (token: string): string | undefined => {
  const [, claims] = token.split(".");
  if (claims === undefined) {
    return undefined;
  }
  const decoded = Result.flatMap(Encoding.decodeBase64UrlString(claims), decodeClaims);
  if (Result.isFailure(decoded)) {
    return undefined;
  }
  return decoded.success.updateTo === undefined ? undefined : decoded.success.email;
};

export { emailChangePrevious, emailChangeTarget };
