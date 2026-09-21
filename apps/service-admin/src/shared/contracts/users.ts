import { roles } from "@repo/config";
import { adminPageSize, maximumAdminPageSize } from "@repo/config/paging";
import { Effect, Schema, SchemaGetter } from "effect";

const maximumIdentifierLength = 256;
const maximumKeywordLength = 100;
const secondPage = 2;

const Role = Schema.Literals(roles);
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
const BooleanText = Schema.Literals(["true", "false"]).transform([true, false]);
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

const UserListQuery = Schema.Struct({
  emailVerified: Schema.optionalKey(BooleanText),
  keyword: Schema.optionalKey(UserKeyword),
  limit: pageNumber(adminPageSize, 1, maximumAdminPageSize),
  offset: pageNumber(0, 0, Number.MAX_SAFE_INTEGER),
  role: Schema.optionalKey(Role),
});

const UserSummary = Schema.Struct({
  createdAt: Schema.DateFromString,
  email: Schema.String,
  emailVerified: Schema.Boolean,
  id: Schema.String,
  name: Schema.String,
  role: Role,
  twoFactorEnabled: Schema.Boolean,
});

const UserList = Schema.Struct({ total: Schema.Finite, users: Schema.Array(UserSummary) });

const RoleChange = Schema.Struct({ id: Identifier, role: Role });

const RoleChanged = Schema.Struct({ id: Schema.String, role: Role });

const UserDeletion = Schema.Struct({ id: Identifier });

const UserDeleted = Schema.Struct({ id: Schema.String });

export {
  BooleanText,
  Role,
  RoleChange,
  RoleChanged,
  SearchKeyword,
  UserDeleted,
  UserDeletion,
  UserList,
  UserListQuery,
  laterPage,
  maximumKeywordLength,
};
