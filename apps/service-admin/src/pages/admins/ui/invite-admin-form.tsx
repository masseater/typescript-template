import { ADMIN_PERMISSION } from "@repo/config";
import { apiData } from "@repo/runtime/client";
import { InvitationForm } from "@repo/ui";

import { adminPermissionOptions, isAdminPermission } from "#pages/admins/model/admin-labels.ts";
import { adminClient } from "#shared/api/index.ts";
import { AdminInvited, type AdminPermission } from "#shared/contracts/index.ts";

import type { ReactElement } from "react";

function inviteAdmin(
  email: string,
  permission: typeof AdminPermission.Type,
): Promise<typeof AdminInvited.Type> {
  return adminClient()
    .admins.invites.post({ email, permission })
    .then((response) => apiData(AdminInvited, response));
}

function InviteAdminForm({ onInvited }: Readonly<{ onInvited: () => void }>): ReactElement {
  return (
    <InvitationForm
      defaultPermission={ADMIN_PERMISSION.viewer}
      invite={inviteAdmin}
      isPermission={isAdminPermission}
      label="管理者を招待する"
      onInvited={onInvited}
      permissionOptions={adminPermissionOptions}
    />
  );
}

export { InviteAdminForm };
