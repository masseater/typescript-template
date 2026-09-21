import { Email, staffPermissions } from "@repo/config";
import { Identifier } from "@repo/runtime/contracts";
import { Schema } from "effect";

const StaffPermission = Schema.Literals(staffPermissions);

const StaffSummary = Schema.Struct({
  createdAt: Schema.DateFromString,
  email: Schema.String,
  id: Schema.String,
  name: Schema.String,
  permission: Schema.optional(StaffPermission),
});

const StaffList = Schema.Array(StaffSummary);

const StaffInvitation = Schema.Struct({ email: Email, permission: StaffPermission });

const StaffInvited = Schema.Struct({ email: Schema.String, expiresAt: Schema.DateFromString });

const StaffPermissionChange = Schema.Struct({ id: Identifier, permission: StaffPermission });

const StaffPermissionChanged = Schema.Struct({
  id: Schema.String,
  permission: Schema.optional(StaffPermission),
});

const StaffRemoval = Schema.Struct({ id: Identifier });

const StaffRemoved = Schema.Struct({ id: Schema.String });

export {
  StaffInvitation,
  StaffInvited,
  StaffList,
  StaffPermission,
  StaffPermissionChange,
  StaffPermissionChanged,
  StaffRemoval,
  StaffRemoved,
};
