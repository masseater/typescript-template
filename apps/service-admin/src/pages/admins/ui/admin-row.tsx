import { useSessionUser } from "@repo/auth-ui";
import {
  Button,
  OperationConfirm,
  SelectField,
  TableCell,
  TableRow,
  formatWarekiDate,
  type Confirmation,
} from "@repo/ui";

import {
  adminPermissionLabels,
  adminPermissionOptions,
  adminStateChangeLabels,
  adminStateLabels,
} from "#pages/admins/model/admin-labels.ts";
import { useAdminRowAction, type RowOperation } from "#pages/admins/model/admin-row-action.ts";
import { nextAccountStates } from "#shared/contracts/index.ts";

import type { ListedAdmin } from "#pages/admins/model/admin-list.ts";
import type { ReactElement } from "react";

function confirmation(admin: ListedAdmin, operation: RowOperation): Confirmation {
  if (operation.kind === "permission") {
    return {
      confirmLabel: "変更する",
      description: `${admin.email} の権限を「${adminPermissionLabels[operation.permission]}」にします。`,
      title: "権限を変更しますか？",
      variant: "primary",
    };
  }
  const change = adminStateChangeLabels[admin.accountState];
  return {
    confirmLabel: change,
    description: `${admin.email} を${adminStateLabels[operation.accountState]}にします。`,
    title: `${change}か？`,
    variant: "danger",
  };
}

function AdminRow({
  admin,
  onChanged,
}: Readonly<{ admin: ListedAdmin; onChanged: () => void }>): ReactElement {
  const { id: selfId } = useSessionUser();
  const action = useAdminRowAction(admin, onChanged);
  const self = admin.id === selfId;
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
      <TableCell>{formatWarekiDate(admin.createdAt)}</TableCell>
      <TableCell>
        {self ? null : (
          <Button
            type="button"
            disabled={action.pending}
            onClick={() => {
              action.handleStateChange(nextAccountStates[admin.accountState]);
            }}
          >
            {adminStateChangeLabels[admin.accountState]}
          </Button>
        )}
        <OperationConfirm
          confirming={action.confirming}
          describe={(operation) => confirmation(admin, operation)}
          onConfirm={action.handleConfirm}
          onOpenChange={action.handleOpenChange}
        />
      </TableCell>
    </TableRow>
  );
}

export { AdminRow };
