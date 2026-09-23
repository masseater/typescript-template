import { ConfirmDialog } from "@repo/ui";

import { rowConfirmation } from "#pages/users/model/user-labels.ts";
import { useUserRowAction } from "#pages/users/model/user-row-action.ts";
import { RowActionMenu } from "./row-action-menu.tsx";

import type { ListedUser } from "#pages/users/model/user-list.ts";
import type { ReactElement } from "react";

function UserRowActions({
  onChanged,
  user,
}: Readonly<{ onChanged: () => void; user: ListedUser }>): ReactElement {
  const action = useUserRowAction(user, onChanged);
  const confirmation = rowConfirmation(action.confirming === "delete", user);
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
        title={confirmation.title}
        description={confirmation.description}
        confirmLabel={confirmation.confirmLabel}
        variant={confirmation.variant}
        onConfirm={action.handleConfirm}
      />
    </>
  );
}

export { UserRowActions };
