import { Email, adminPermissions } from "@repo/config";
import { Identifier, InvitationIssued } from "@repo/runtime/contracts";
import { Schema } from "effect";

import { AccountState, MemberStateChange, MemberStateChanged } from "./users.ts";

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

const AdminInvited = InvitationIssued;

const AdminPermissionChange = Schema.Struct({ id: Identifier, permission: AdminPermission });

const AdminPermissionChanged = Schema.Struct({
  id: Schema.String,
  permission: Schema.optional(AdminPermission),
});

const AdminStateChange = MemberStateChange;

const AdminStateChanged = MemberStateChanged;

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
