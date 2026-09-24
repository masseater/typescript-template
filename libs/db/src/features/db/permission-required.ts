import { accountPermissions } from "@repo/config";
import { Schema } from "effect";

class PermissionRequired extends Schema.TaggedError<PermissionRequired>()("PermissionRequired", {
  required: Schema.Literals(accountPermissions),
}) {}

export { PermissionRequired };
