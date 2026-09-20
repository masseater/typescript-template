import { Encoding, Result, Schema } from "effect";

const VerificationClaims = Schema.Struct({ updateTo: Schema.optional(Schema.String) });

const decodeClaims = Schema.decodeUnknownResult(Schema.fromJsonString(VerificationClaims));

const emailChangeTarget = (token: string): string | undefined => {
  const [, claims] = token.split(".");
  if (claims === undefined) {
    return undefined;
  }
  const decoded = Result.flatMap(Encoding.decodeBase64UrlString(claims), decodeClaims);
  return Result.isSuccess(decoded) ? decoded.success.updateTo : undefined;
};

export { emailChangeTarget };
