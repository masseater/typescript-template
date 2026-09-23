import { Effect, Option, Schema, SchemaGetter } from "effect";

const adminPageSize = 50;
const maximumAdminPageSize = 100;
const maximumIdentifierLength = 256;
const maximumKeywordLength = 100;
const secondPage = 2;

const Identifier = Schema.String.check(Schema.isLengthBetween(1, maximumIdentifierLength));

function pageNumber(
  fallback: number,
  minimum: number,
  maximum: number,
): Schema.withDecodingDefaultKey<Schema.FiniteFromString> {
  const range = Schema.isBetween({ maximum, minimum });
  const bounded = Schema.FiniteFromString.check(Schema.isInt(), range);
  const fallbackText = Effect.succeed(String(fallback));
  return bounded.pipe(Schema.withDecodingDefaultKey(fallbackText));
}

const UserKeyword = Schema.Trim.check(Schema.isLengthBetween(1, maximumKeywordLength));
const JsonScalar = Schema.Union([Schema.String, Schema.Finite, Schema.Boolean, Schema.Null]);
const ScalarText = JsonScalar.pipe(
  Schema.decodeTo(Schema.String, {
    decode: SchemaGetter.transform<string, string | number | boolean | null>(String),
    encode: SchemaGetter.transform((text: string) => text),
  }),
);
const SearchKeyword = ScalarText.pipe(Schema.decodeTo(UserKeyword));

function laterPage(maximum: number): Schema.Codec<number, number | string> {
  return Schema.Union([Schema.Finite, Schema.FiniteFromString]).check(
    Schema.isInt(),
    Schema.isBetween({ maximum, minimum: secondPage }),
  );
}

class InvalidSearch extends Schema.TaggedError<InvalidSearch>()("InvalidSearch", {}) {}

function searchNormalizer<T>(schema: Schema.Decoder<T>): (raw: unknown) => T {
  const decode = Schema.decodeUnknownOption(schema);
  return (raw) => Option.getOrThrowWith(decode(raw), () => new InvalidSearch());
}

export {
  Identifier,
  InvalidSearch,
  SearchKeyword,
  UserKeyword,
  adminPageSize,
  laterPage,
  maximumAdminPageSize,
  maximumKeywordLength,
  pageNumber,
  searchNormalizer,
};
