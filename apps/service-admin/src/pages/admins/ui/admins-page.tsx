import { ForbiddenNotice, useSessionUser } from "@repo/auth-ui";
import { ADMIN_PERMISSION, grantsAdminLevel } from "@repo/config";
import { Button, localState } from "@repo/ui";

import { useAdminList } from "#pages/admins/model/admin-list.ts";
import { OpsPage } from "#widgets/ops-page/index.ts";
import { AdminsTable } from "./admins-table.tsx";
import { InviteAdminForm } from "./invite-admin-form.tsx";

import type { ReactElement } from "react";

const useInviting = localState(false);

function AdminsBoard(): ReactElement {
  const { listing, reload } = useAdminList();
  const [inviting, setInviting] = useInviting();
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
      {inviting ? <InviteAdminForm onInvited={reload} /> : null}
      <AdminsTable listing={listing} onReload={reload} />
    </>
  );
}

function AdminsPage(): ReactElement {
  const { permission } = useSessionUser();
  return (
    <OpsPage title="管理者">
      {grantsAdminLevel(permission, ADMIN_PERMISSION.owner) ? <AdminsBoard /> : <ForbiddenNotice />}
    </OpsPage>
  );
}

export { AdminsPage };
