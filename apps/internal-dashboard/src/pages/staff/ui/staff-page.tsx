import { ForbiddenNotice, useSessionUser } from "@repo/auth-ui";
import { STAFF_PERMISSION, grantsStaffLevel } from "@repo/config";
import { Button } from "@repo/ui";
import { useState } from "react";

import { useStaffList } from "#pages/staff/model/staff-list.ts";
import { OpsPage } from "#widgets/ops-page/index.ts";
import { InviteStaffForm } from "./invite-staff-form.tsx";
import { StaffTable } from "./staff-table.tsx";

import type { ReactElement } from "react";

function StaffBoard(): ReactElement {
  const { reload, state } = useStaffList();
  const [inviting, setInviting] = useState(false);
  return (
    <>
      <div>
        <Button
          type="button"
          variant="primary"
          aria-expanded={inviting}
          onClick={() => {
            setInviting((open) => !open);
          }}
        >
          招待する
        </Button>
      </div>
      {inviting ? <InviteStaffForm onInvited={reload} /> : null}
      <StaffTable state={state} onReload={reload} />
    </>
  );
}

function StaffPage(): ReactElement {
  const { permission } = useSessionUser();
  return (
    <OpsPage title="メンバー">
      {grantsStaffLevel(permission, STAFF_PERMISSION.editor) ? <StaffBoard /> : <ForbiddenNotice />}
    </OpsPage>
  );
}

export { StaffPage };
