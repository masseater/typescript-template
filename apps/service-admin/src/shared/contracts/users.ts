import { accountStates } from "@repo/config";
import { Effect, Schema, SchemaGetter } from "effect";

const maximumIdentifierLength = 256;
const maximumKeywordLength = 100;
const secondPage = 2;
const defaultPageSize = 50;
const maximumPageSize = 100;

const AccountState = Schema.Literals(accountStates);
const Identifier = Schema.String.check(Schema.isLengthBetween(1, maximumIdentifierLength));

function pageNumber(
  fallback: number,
  minimum: number,
  maximum: number,
): Schema.withDecodingDefaultKey<Schema.NumberFromString> {
  const range = Schema.isBetween({ maximum, minimum });
  const bounded = Schema.NumberFromString.check(Schema.isInt(), range);
  const fallbackText = Effect.succeed(String(fallback));
  return bounded.pipe(Schema.withDecodingDefaultKey(fallbackText));
}

const UserKeyword = Schema.Trim.check(Schema.isLengthBetween(1, maximumKeywordLength));
const BooleanText = Schema.Literals(["true", "false"]).transform([true, false]);
const JsonScalar = Schema.Union([Schema.String, Schema.Number, Schema.Boolean, Schema.Null]);
const ScalarText = JsonScalar.pipe(
  Schema.decodeTo(Schema.String, {
    decode: SchemaGetter.transform<string, string | number | boolean | null>(String),
    encode: SchemaGetter.transform((text: string) => text),
  }),
);
const SearchKeyword = ScalarText.pipe(Schema.decodeTo(UserKeyword));

function laterPage(maximum: number): Schema.Codec<number, number | string> {
  return Schema.Union([Schema.Number, Schema.NumberFromString]).check(
    Schema.isInt(),
    Schema.isBetween({ maximum, minimum: secondPage }),
  );
}

const UserListQuery = Schema.Struct({
  accountState: Schema.optionalKey(AccountState),
  emailVerified: Schema.optionalKey(BooleanText),
  keyword: Schema.optionalKey(UserKeyword),
  limit: pageNumber(defaultPageSize, 1, maximumPageSize),
  offset: pageNumber(0, 0, Number.MAX_SAFE_INTEGER),
});

const UserSummary = Schema.Struct({
  accountState: AccountState,
  createdAt: Schema.DateFromString,
  email: Schema.String,
  emailVerified: Schema.Boolean,
  id: Schema.String,
  name: Schema.String,
  twoFactorEnabled: Schema.Boolean,
});

const UserList = Schema.Struct({ total: Schema.Finite, users: Schema.Array(UserSummary) });

const MemberStateChange = Schema.Struct({ accountState: AccountState, id: Identifier });

const MemberStateChanged = Schema.Struct({ accountState: AccountState, id: Schema.String });

const UserDeletion = Schema.Struct({ id: Identifier });

const UserDeleted = Schema.Struct({ id: Schema.String });

export {
  AccountState,
  BooleanText,
  Identifier,
  MemberStateChange,
  MemberStateChanged,
  SearchKeyword,
  UserDeleted,
  UserDeletion,
  UserList,
  UserListQuery,
  laterPage,
  maximumKeywordLength,
};
