import { Email, adminPermissions } from "@repo/config";
import { Identifier } from "@repo/runtime/contracts";
import { Schema } from "effect";

import { AccountState } from "./users.ts";

const AdminPermission = Schema.Literals(adminPermissions);

const AdminSummary = Schema.Struct({
  accountState: AccountState,
  createdAt: Schema.DateFromString,
  email: Schema.String,
  id: Schema.String,
  name: Schema.String,
  permission: Schema.optional(AdminPermission),
});

const AdminList = Schema.Array(AdminSummary);

const AdminInvitation = Schema.Struct({ email: Email, permission: AdminPermission });

const AdminInvited = Schema.Struct({ email: Schema.String, expiresAt: Schema.DateFromString });

const AdminPermissionChange = Schema.Struct({ id: Identifier, permission: AdminPermission });

const AdminPermissionChanged = Schema.Struct({
  id: Schema.String,
  permission: Schema.optional(AdminPermission),
});

const AdminStateChange = Schema.Struct({ accountState: AccountState, id: Identifier });

const AdminStateChanged = Schema.Struct({ accountState: AccountState, id: Schema.String });

export {
  AdminInvitation,
  AdminInvited,
  AdminList,
  AdminPermission,
  AdminPermissionChange,
  AdminPermissionChanged,
  AdminStateChange,
  AdminStateChanged,
};
