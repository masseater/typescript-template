import { Option, Schema } from "effect";

type SearchField = (raw: unknown) => Option.Option<unknown>;
type SearchFields = Readonly<Record<string, SearchField>>;
type SearchOf<Fields extends SearchFields> = {
  readonly [Key in keyof Fields]?: ReturnType<Fields[Key]> extends Option.Option<infer Value>
    ? Value
    : never;
};

const secondPage = 2;

const JsonScalar = Schema.Union([Schema.String, Schema.Number, Schema.Boolean, Schema.Null]);
const PageNumber = Schema.Union([Schema.Number, Schema.NumberFromString]).check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(secondPage),
);

const decodeScalar = Schema.decodeUnknownOption(JsonScalar);
const isSearchRecord = Schema.is(Schema.Record(Schema.String, Schema.Unknown));

function searchText<Value>(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  schema: Schema.Codec<Value, string>,
): (raw: unknown) => Option.Option<Value> {
  const decode = Schema.decodeUnknownOption(schema);
  return (raw: unknown) => Option.flatMap(decodeScalar(raw), (value) => decode(String(value)));
}

function laterPage(maximum?: number): (raw: unknown) => Option.Option<number> {
  return Schema.decodeUnknownOption(
    maximum === undefined ? PageNumber : PageNumber.check(Schema.isLessThanOrEqualTo(maximum)),
  );
}

function searchNormalizer<Fields extends SearchFields>(
  fields: Fields,
): (raw: unknown) => SearchOf<Fields> {
  return (raw: unknown): SearchOf<Fields> => {
    const record = isSearchRecord(raw) ? raw : {};
    const kept = Object.entries(fields).flatMap(([key, decode]: readonly [string, SearchField]) => {
      const value = decode(record[key]);
      return Option.isSome(value) ? [[key, value.value] as const] : [];
    });
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return Object.fromEntries(kept) as SearchOf<Fields>;
  };
}

export { laterPage, searchNormalizer, searchText };
