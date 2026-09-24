import { accountStates } from "@repo/config";
import { adminPageSize, maximumAdminPageSize } from "@repo/config/paging";
import {
  Identifier,
  IdentifierQuery,
  SearchKeyword,
  UserKeyword,
  laterPage,
  maximumKeywordLength,
  pageNumber,
} from "@repo/runtime/contracts";
import { Schema, Struct } from "effect";

const AccountState = Schema.Literals(accountStates);

const BooleanText = Schema.Literals(["true", "false"]).transform([true, false]);

const UserListQuery = Schema.Struct({
  accountState: Schema.optionalKey(AccountState),
  emailVerified: Schema.optionalKey(BooleanText),
  keyword: Schema.optionalKey(UserKeyword),
  limit: pageNumber({ fallback: adminPageSize, maximum: maximumAdminPageSize, minimum: 1 }),
  offset: pageNumber({ fallback: 0, maximum: Number.MAX_SAFE_INTEGER, minimum: 0 }),
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

const UserDeletion = IdentifierQuery;

const UserDeleted = Schema.Struct(Struct.pick(UserSummary.fields, ["id"]));

export {
  AccountState,
  BooleanText,
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
