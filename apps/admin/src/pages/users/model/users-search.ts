import { BooleanText, Role, UserKeyword } from "@template/runtime/contracts";
import { Option, Schema } from "effect";
import { secondPage, usersPageSize } from "./users-pagination.ts";

const PageNumber = Schema.Union([Schema.Number, Schema.NumberFromString]).check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(secondPage),
);
const Verified = Schema.Union([Schema.Boolean, BooleanText]);

const isSearchRecord = Schema.is(Schema.Record(Schema.String, Schema.Unknown));
const isJsonScalar = Schema.is(Schema.Union([Schema.Number, Schema.Boolean, Schema.Null]));

interface UsersSearch {
  readonly keyword?: typeof UserKeyword.Type;
  readonly page?: number;
  readonly role?: typeof Role.Type;
  readonly verified?: boolean;
}

function decoded<Type>(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  schema: Schema.Codec<Type, unknown>,
  value: unknown,
): Readonly<{ value: Type }> | undefined {
  const decodedValue = Schema.decodeUnknownOption(schema)(value);
  return Option.getOrUndefined(Option.map(decodedValue, (success) => ({ value: success })));
}

function normalizeUsersSearch(raw: unknown): UsersSearch {
  const search = isSearchRecord(raw) ? raw : {};
  const keywordInput = search["keyword"];
  const keyword = decoded(
    UserKeyword,
    isJsonScalar(keywordInput) ? String(keywordInput) : keywordInput,
  );
  const page = decoded(PageNumber, search["page"]);
  const role = decoded(Role, search["role"]);
  const verified = decoded(Verified, search["verified"]);
  return {
    ...(keyword && { keyword: keyword.value }),
    ...(page && { page: page.value }),
    ...(role && { role: role.value }),
    ...(verified && { verified: verified.value }),
  };
}

function userListQuery(search: UsersSearch): Readonly<Record<string, string>> {
  return {
    limit: String(usersPageSize),
    offset: String(((search.page ?? 1) - 1) * usersPageSize),
    ...(search.keyword === undefined ? {} : { keyword: search.keyword }),
    ...(search.role === undefined ? {} : { role: search.role }),
    ...(search.verified === undefined ? {} : { emailVerified: String(search.verified) }),
  };
}

export { normalizeUsersSearch, userListQuery };
export type { UsersSearch };
