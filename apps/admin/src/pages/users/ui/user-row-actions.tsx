import { nextRoles, roleLabels } from "#pages/users/model/user-labels.ts";
import { ConfirmDialog } from "@repo/ui";
import type { ListedUser } from "#pages/users/model/user-list.ts";
import type { ReactElement } from "react";
import { RowActionMenu } from "./row-action-menu.tsx";
import { useUserRowAction } from "#pages/users/model/user-row-action.ts";

function UserRowActions({
  onChanged,
  user,
}: Readonly<{ onChanged: () => void; user: ListedUser }>): ReactElement {
  const action = useUserRowAction(user, onChanged);
  const deleting = action.confirming === "delete";
  const nextRole = roleLabels[nextRoles[user.role]];
  return (
    <>
      <RowActionMenu
        user={user}
        disabled={action.pending}
        onDelete={action.handleDelete}
        onRoleChange={action.handleRoleChange}
      />
      <ConfirmDialog
        open={action.confirming !== undefined}
        onOpenChange={action.handleOpenChange}
        title={deleting ? "ユーザーを削除しますか？" : "権限を変更しますか？"}
        description={
          deleting
            ? `${user.email} を削除します。この操作は取り消せません。`
            : `${user.email} を${nextRole}に変更します。対象ユーザーの既存セッションは失効します。`
        }
        confirmLabel={deleting ? "削除する" : "変更する"}
        variant={deleting ? "danger" : "primary"}
        onConfirm={action.handleConfirm}
      />
    </>
  );
}

export { UserRowActions };
