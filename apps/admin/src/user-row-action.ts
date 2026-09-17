import { RoleChanged, UserDeleted } from "@template/runtime/contracts";
import type { ListedUser } from "#user-list.ts";
import { adminClient } from "#api-client.ts";
import { apiData } from "@template/runtime/client";
import { errorMessage } from "@template/ui";
import { nextRoles } from "#user-labels.ts";
import { useState } from "react";
import { useToast } from "@template/ui/ui";

type RowOperation = "delete" | "role";

interface UserRowAction {
  readonly handleConfirm: () => void;
  readonly handleDelete: () => void;
  readonly handleRoleChange: () => void;
  readonly confirming: RowOperation | undefined;
  readonly handleOpenChange: (open: boolean) => void;
  readonly pending: boolean;
}

async function perform(user: ListedUser, operation: RowOperation): Promise<string> {
  const { users } = adminClient();
  if (operation === "delete") {
    apiData(UserDeleted, await users.delete({ id: user.id }));
    return `${user.email} を削除しました。`;
  }
  const role = nextRoles[user.role];
  apiData(RoleChanged, await users.patch({ id: user.id, role }));
  return `${user.email} の権限を変更しました。対象ユーザーの既存セッションは失効しました。`;
}

function useUserRowAction(user: ListedUser, onChanged: () => void): UserRowAction {
  const notify = useToast();
  const [confirming, setConfirming] = useState<RowOperation>();
  const [pending, setPending] = useState(false);
  function handleRoleChange(): void {
    setConfirming("role");
  }
  function handleDelete(): void {
    setConfirming("delete");
  }
  function handleOpenChange(open: boolean): void {
    if (!open) {
      setConfirming(undefined);
    }
  }
  function handleConfirm(): void {
    if (confirming === undefined) {
      return;
    }
    setConfirming(undefined);
    setPending(true);
    async function run(operation: RowOperation): Promise<void> {
      try {
        notify("success", await perform(user, operation));
        onChanged();
      } catch (error) {
        notify("error", errorMessage(error));
      }
      setPending(false);
    }
    void run(confirming);
  }
  return {
    confirming,
    handleConfirm,
    handleDelete,
    handleOpenChange,
    handleRoleChange,
    pending,
  };
}

export { useUserRowAction };
