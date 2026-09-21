import { useSessionUser } from "@repo/auth-ui";
import { ACCOUNT_STATE } from "@repo/config";
import { Button, ConfirmDialog, SelectField, TableCell, TableRow } from "@repo/ui";

import {
  adminPermissionLabels,
  adminPermissionOptions,
  adminStateChangeLabels,
  adminStateLabels,
} from "#pages/admins/model/admin-labels.ts";
import { useAdminRowAction, type RowOperation } from "#pages/admins/model/admin-row-action.ts";

import type { ListedAdmin } from "#pages/admins/model/admin-list.ts";
import type { ReactElement } from "react";

function confirmation(
  admin: ListedAdmin,
  operation: RowOperation,
): Readonly<{ confirmLabel: string; description: string; title: string }> {
  if (operation.kind === "permission") {
    return {
      confirmLabel: "変更する",
      description: `${admin.email} の権限を「${adminPermissionLabels[operation.permission]}」にします。`,
      title: "権限を変更しますか？",
    };
  }
  const change = adminStateChangeLabels[admin.accountState];
  return {
    confirmLabel: change,
    description: `${admin.email} を${adminStateLabels[operation.accountState]}にします。`,
    title: `${change}か？`,
  };
}

function AdminRow({
  admin,
  onChanged,
}: Readonly<{ admin: ListedAdmin; onChanged: () => void }>): ReactElement {
  const { id: selfId } = useSessionUser();
  const action = useAdminRowAction(admin, onChanged);
  const self = admin.id === selfId;
  const nextState =
    admin.accountState === ACCOUNT_STATE.active ? ACCOUNT_STATE.suspended : ACCOUNT_STATE.active;
  return (
    <TableRow>
      <TableCell>{admin.name}</TableCell>
      <TableCell>{admin.email}</TableCell>
      <TableCell>
        <SelectField
          label={`${admin.email} の権限`}
          name={`permission-${admin.id}`}
          options={adminPermissionOptions}
          value={admin.permission ?? ""}
          onValueChange={action.handlePermissionChange}
        />
      </TableCell>
      <TableCell>{adminStateLabels[admin.accountState]}</TableCell>
      <TableCell>{admin.registeredOn}</TableCell>
      <TableCell>
        {self ? null : (
          <Button
            type="button"
            disabled={action.pending}
            onClick={() => {
              action.handleStateChange(nextState);
            }}
          >
            {adminStateChangeLabels[admin.accountState]}
          </Button>
        )}
        {action.confirming === undefined
          ? null
          : (() => {
              const confirmed = confirmation(admin, action.confirming);
              return (
                <ConfirmDialog
                  open
                  confirmLabel={confirmed.confirmLabel}
                  description={confirmed.description}
                  title={confirmed.title}
                  onOpenChange={action.handleOpenChange}
                  variant={action.confirming.kind === "state" ? "danger" : "primary"}
                  onConfirm={action.handleConfirm}
                />
              );
            })()}
      </TableCell>
    </TableRow>
  );
}

export { AdminRow };
