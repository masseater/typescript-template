import { useSessionUser } from "@repo/auth-ui";
import { Button, ConfirmDialog, SelectField, TableCell, TableRow } from "@repo/ui";

import { staffPermissionLabels, staffPermissionOptions } from "#pages/staff/model/staff-labels.ts";
import { useStaffRowAction, type RowOperation } from "#pages/staff/model/staff-row-action.ts";

import type { ListedStaff } from "#pages/staff/model/staff-list.ts";
import type { ReactElement } from "react";

function confirmation(
  member: ListedStaff,
  operation: RowOperation,
): Readonly<{ confirmLabel: string; description: string; title: string }> {
  if (operation.kind === "permission") {
    return {
      confirmLabel: "変更する",
      description: `${member.email} の権限を「${staffPermissionLabels[operation.permission]}」にします。`,
      title: "権限を変更しますか？",
    };
  }
  return {
    confirmLabel: "削除する",
    description: `${member.email} を社内ダッシュボードから削除します。この操作は取り消せません。`,
    title: "メンバーを削除しますか？",
  };
}

function StaffRow({
  member,
  onChanged,
}: Readonly<{ member: ListedStaff; onChanged: () => void }>): ReactElement {
  const { id: selfId } = useSessionUser();
  const action = useStaffRowAction(member, onChanged);
  const self = member.id === selfId;
  return (
    <TableRow>
      <TableCell>{member.name}</TableCell>
      <TableCell>{member.email}</TableCell>
      <TableCell>
        <SelectField
          label={`${member.email} の権限`}
          name={`permission-${member.id}`}
          options={staffPermissionOptions}
          value={member.permission ?? ""}
          onValueChange={action.handlePermissionChange}
        />
      </TableCell>
      <TableCell>{member.registeredOn}</TableCell>
      <TableCell>
        {self ? null : (
          <Button
            type="button"
            variant="danger"
            disabled={action.pending}
            onClick={action.handleRemove}
          >
            削除
          </Button>
        )}
        {action.confirming === undefined
          ? null
          : (() => {
              const confirmed = confirmation(member, action.confirming);
              return (
                <ConfirmDialog
                  open
                  confirmLabel={confirmed.confirmLabel}
                  description={confirmed.description}
                  title={confirmed.title}
                  onOpenChange={action.handleOpenChange}
                  variant={action.confirming.kind === "remove" ? "danger" : "primary"}
                  onConfirm={action.handleConfirm}
                />
              );
            })()}
      </TableCell>
    </TableRow>
  );
}

export { StaffRow };
