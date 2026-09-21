import { ACCOUNT_STATE } from "@repo/config";
import { ConfirmDialog } from "@repo/ui";

import { nextAccountStates, stateChangeLabels } from "#pages/users/model/user-labels.ts";
import { useUserRowAction } from "#pages/users/model/user-row-action.ts";
import { RowActionMenu } from "./row-action-menu.tsx";

import type { ListedUser } from "#pages/users/model/user-list.ts";
import type { ReactElement } from "react";

function UserRowActions({
  onChanged,
  user,
}: Readonly<{ onChanged: () => void; user: ListedUser }>): ReactElement {
  const action = useUserRowAction(user, onChanged);
  const deleting = action.confirming === "delete";
  const stateChange = stateChangeLabels[user.accountState];
  const suspending = nextAccountStates[user.accountState] === ACCOUNT_STATE.suspended;
  return (
    <>
      <RowActionMenu
        user={user}
        disabled={action.pending}
        onDelete={action.handleDelete}
        onStateChange={action.handleStateChange}
      />
      <ConfirmDialog
        open={action.confirming !== undefined}
        onOpenChange={action.handleOpenChange}
        title={deleting ? "ユーザーを削除しますか？" : `${stateChange}か？`}
        description={
          deleting
            ? `${user.email} を削除します。この操作は取り消せません。`
            : suspending
              ? `${user.email} の利用を停止します。停止中はログインできず、他の利用者から見えなくなります。`
              : `${user.email} の停止を解除します。再びログインでき、他の利用者から見えるようになります。`
        }
        confirmLabel={deleting ? "削除する" : stateChange}
        variant={deleting || suspending ? "danger" : "primary"}
        onConfirm={action.handleConfirm}
      />
    </>
  );
}

export { UserRowActions };
