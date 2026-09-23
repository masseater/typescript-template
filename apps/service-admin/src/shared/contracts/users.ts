import { roles } from "@repo/config";
import {
  Identifier,
  UserKeyword,
  adminPageSize,
  maximumAdminPageSize,
  pageNumber,
} from "@repo/config/paging";
import { Schema } from "effect";

const Role = Schema.Literals(roles);
const BooleanText = Schema.Literals(["true", "false"]).transform([true, false]);
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
  UserDeleted,
  UserDeletion,
  UserList,
  UserListQuery,
};
