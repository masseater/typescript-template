import { Encoding, Result, Schema } from "effect";

const VerificationClaims = Schema.Struct({
  email: Schema.optional(Schema.String),
  updateTo: Schema.optional(Schema.String),
});

const decodeClaims = Schema.decodeUnknownResult(Schema.fromJsonString(VerificationClaims));

const decodedClaims = (token: string) => {
  const [, claims] = token.split(".");
  if (claims === undefined) {
    return undefined;
  }
  const decoded = Result.flatMap(Encoding.decodeBase64UrlString(claims), decodeClaims);
  return Result.isSuccess(decoded) ? decoded.success : undefined;
};

const emailChangeTarget = (token: string): string | undefined => decodedClaims(token)?.updateTo;

const emailChangePrevious = (token: string): string | undefined => {
  const claims = decodedClaims(token);
  return claims?.updateTo === undefined ? undefined : claims.email;
};

export { emailChangePrevious, emailChangeTarget };
