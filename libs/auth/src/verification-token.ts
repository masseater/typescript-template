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

const decodeTokenClaims = (
  token: string,
): Result.Result<typeof VerificationClaims.Type, VerificationTokenInvalid> => {
  const [, claims] = token.split(".");
  if (claims === undefined) {
    return Result.fail(new VerificationTokenInvalid());
  }
  const decoded = Result.flatMap(Encoding.decodeBase64UrlString(claims), decodeClaims);
  if (Result.isFailure(decoded)) {
    return Result.fail(new VerificationTokenInvalid());
  }
  return Result.succeed(decoded.success);
};

const emailChangeTarget = (
  token: string,
): Result.Result<string | undefined, VerificationTokenInvalid> =>
  Result.map(decodeTokenClaims(token), (claims) => claims.updateTo);

const emailChangePrevious = (token: string): string | undefined => {
  const claims = decodeTokenClaims(token);
  if (Result.isFailure(claims)) {
    return undefined;
  }
  return claims.success.updateTo === undefined ? undefined : claims.success.email;
};

export { emailChangePrevious, emailChangeTarget };
