import { EmailVerificationFilter, Role, UserKeyword } from "@template/runtime/contracts";
import { Option, Schema } from "effect";
import { usersPageSize } from "#users-pagination.ts";

const SECOND_PAGE = 2;

const PageNumber = Schema.Union([Schema.Number, Schema.NumberFromString]).check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(SECOND_PAGE),
);

const isSearchRecord = Schema.is(Schema.Record(Schema.String, Schema.Unknown));
const isVerificationText = Schema.is(EmailVerificationFilter);

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
  const verifiedInput = search["verified"];
  const keyword = decoded(
    UserKeyword,
    typeof keywordInput === "number" ? String(keywordInput) : keywordInput,
  );
  const page = decoded(PageNumber, search["page"]);
  const role = decoded(Role, search["role"]);
  const verified = decoded(
    Schema.Boolean,
    isVerificationText(verifiedInput) ? verifiedInput === "true" : verifiedInput,
  );
  return {
    ...(keyword && { keyword: keyword.value }),
    ...(page && { page: page.value }),
    ...(role && { role: role.value }),
    ...(verified && { verified: verified.value }),
  };
}

function userListRequestPath(search: UsersSearch): string {
  const params = new URLSearchParams({
    limit: String(usersPageSize),
    offset: String(((search.page ?? 1) - 1) * usersPageSize),
  });
  for (const [name, value] of [
    ["keyword", search.keyword],
    ["role", search.role],
    ["verified", search.verified === undefined ? undefined : String(search.verified)],
  ] as const) {
    if (value !== undefined) {
      params.set(name, value);
    }
  }
  return `/api/users?${params.toString()}`;
}

export { normalizeUsersSearch, userListRequestPath };
export type { UsersSearch };
