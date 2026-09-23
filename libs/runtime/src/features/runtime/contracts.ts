import { applications } from "@repo/config";
import { roles } from "@repo/config/identity";
import { Effect, Schema, SchemaGetter } from "effect";

const maximumTokenLength = 4096;
const ErrorBody = Schema.Struct({ error: Schema.String });
const SessionView = Schema.Struct({
  strong: Schema.Boolean,
  user: Schema.Struct({
    email: Schema.String,
    id: Schema.String,
    name: Schema.String,
    role: Schema.Literals(roles),
    twoFactorEnabled: Schema.Boolean,
  }),
});
const EmailVerificationRequest = Schema.Struct({
  token: Schema.String.check(Schema.isLengthBetween(1, maximumTokenLength)),
});
const EmailVerified = Schema.Struct({ verified: Schema.Literal(true) });
const HealthView = Schema.Struct({
  ok: Schema.Literal(true),
  release: Schema.String,
  service: Schema.Literals(applications),
});

const maximumIdentifierLength = 256;
const Identifier = Schema.String.check(Schema.isLengthBetween(1, maximumIdentifierLength));
const IdentifierQuery = Schema.Struct({ id: Identifier });
const CreatedResource = Schema.Struct({ id: Schema.String });

const pageNumber = ({
  fallback,
  maximum,
  minimum,
}: {
  readonly fallback: number;
  readonly maximum: number;
  readonly minimum: number;
}): Schema.withDecodingDefaultKey<Schema.FiniteFromString> => {
  const range = Schema.isBetween({ maximum, minimum });
  const bounded = Schema.FiniteFromString.check(Schema.isInt(), range);
  const fallbackText = Effect.succeed(String(fallback));
  return bounded.pipe(Schema.withDecodingDefaultKey(fallbackText));
};

const secondPage = 2;
const laterPage = (maximum: number): Schema.Codec<number, number | string> =>
  Schema.Union([Schema.Finite, Schema.FiniteFromString]).check(
    Schema.isInt(),
    Schema.isBetween({ maximum, minimum: secondPage }),
  );

const maximumKeywordLength = 100;
const UserKeyword = Schema.Trim.check(Schema.isLengthBetween(1, maximumKeywordLength));
const JsonScalar = Schema.Union([Schema.String, Schema.Finite, Schema.Boolean, Schema.Null]);
const ScalarText = JsonScalar.pipe(
  Schema.decodeTo(Schema.String, {
    decode: SchemaGetter.transform<string, string | number | boolean | null>(String),
    encode: SchemaGetter.transform((scalarText: string) => scalarText),
  }),
);
const SearchKeyword = ScalarText.pipe(Schema.decodeTo(UserKeyword));

type Decodable = Schema.Top & { readonly DecodingServices: never };

export {
  CreatedResource,
  EmailVerificationRequest,
  EmailVerified,
  ErrorBody,
  HealthView,
  Identifier,
  IdentifierQuery,
  SearchKeyword,
  SessionView,
  UserKeyword,
  laterPage,
  maximumKeywordLength,
  pageNumber,
};
export type { Decodable };
