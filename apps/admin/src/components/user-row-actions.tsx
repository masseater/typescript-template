import { ConfirmDialog } from "@template/ui/ui";
import type { ListedUser } from "#user-list.ts";
import type { ReactElement } from "react";
import { RowActionMenu } from "#components/row-action-menu.tsx";
import { useUserRowAction } from "#user-row-action.ts";

function UserRowActions({
  onChanged,
  user,
}: Readonly<{ onChanged: () => void; user: ListedUser }>): ReactElement {
  const action = useUserRowAction(user, onChanged);
  const deleting = action.confirming === "delete";
  const nextRole = user.role === "admin" ? "一般ユーザー" : "管理者";
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
