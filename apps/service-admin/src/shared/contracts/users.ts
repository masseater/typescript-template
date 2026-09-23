import { roles } from "@repo/config";
import { adminPageSize, maximumAdminPageSize } from "@repo/config/paging";
import {
  CreatedResource,
  Identifier,
  IdentifierQuery,
  SearchKeyword,
  UserKeyword,
  laterPage,
  maximumKeywordLength,
  pageNumber,
} from "@repo/runtime/contracts";
import { Schema } from "effect";

const Role = Schema.Literals(roles);

const BooleanText = Schema.Literals(["true", "false"]).transform([true, false]);

const UserListQuery = Schema.Struct({
  emailVerified: Schema.optionalKey(BooleanText),
  keyword: Schema.optionalKey(UserKeyword),
  limit: pageNumber({ fallback: adminPageSize, maximum: maximumAdminPageSize, minimum: 1 }),
  offset: pageNumber({ fallback: 0, maximum: Number.MAX_SAFE_INTEGER, minimum: 0 }),
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

const UserDeletion = IdentifierQuery;

const UserDeleted = CreatedResource;

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
