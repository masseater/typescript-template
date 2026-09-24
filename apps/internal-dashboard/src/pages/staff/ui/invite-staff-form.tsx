import { STAFF_PERMISSION } from "@repo/config";
import { apiData } from "@repo/runtime/client";
import { InvitationForm } from "@repo/ui";

import { isStaffPermission, staffPermissionOptions } from "#pages/staff/model/staff-labels.ts";
import { wikiClient } from "#shared/api/index.ts";
import { StaffInvited, type StaffPermission } from "#shared/contracts/index.ts";

import type { ReactElement } from "react";

function inviteStaff(
  email: string,
  permission: typeof StaffPermission.Type,
): Promise<typeof StaffInvited.Type> {
  return Promise.resolve(wikiClient())
    .then(({ api }) => api.staff.invites.post({ email, permission }))
    .then((response) => apiData(StaffInvited, response));
}

function InviteStaffForm({ onInvited }: Readonly<{ onInvited: () => void }>): ReactElement {
  return (
    <InvitationForm
      defaultPermission={STAFF_PERMISSION.viewer}
      invite={inviteStaff}
      isPermission={isStaffPermission}
      label="メンバーを招待する"
      onInvited={onInvited}
      permissionOptions={staffPermissionOptions}
    />
  );
}

export { InviteStaffForm };
