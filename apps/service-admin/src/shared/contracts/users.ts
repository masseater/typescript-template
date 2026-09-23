import { accountStates } from "@repo/config";
import { UserKeyword, adminPageSize, maximumAdminPageSize, pageNumber } from "@repo/config/paging";
import { Identifier } from "@repo/runtime/contracts";
import { Schema } from "effect";

const AccountState = Schema.Literals(accountStates);
const BooleanText = Schema.Literals(["true", "false"]).transform([true, false]);

const UserListQuery = Schema.Struct({
  accountState: Schema.optionalKey(AccountState),
  emailVerified: Schema.optionalKey(BooleanText),
  keyword: Schema.optionalKey(UserKeyword),
  limit: pageNumber(adminPageSize, 1, maximumAdminPageSize),
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
  MemberStateChange,
  MemberStateChanged,
  UserDeleted,
  UserDeletion,
  UserList,
  UserListQuery,
};
