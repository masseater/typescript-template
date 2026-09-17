import { RoleChanged, UserDeleted } from "@template/runtime/contracts";
import { useCallback, useState } from "react";
import type { ListedUser } from "#user-list.ts";
import { errorMessage } from "@template/ui";
import { requestJson } from "@template/runtime/client";
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
  if (operation === "delete") {
    await requestJson("/api/users", UserDeleted, { body: { id: user.id }, method: "DELETE" });
    return `${user.email} を削除しました。`;
  }
  const role = user.role === "admin" ? "user" : "admin";
  await requestJson("/api/users", RoleChanged, { body: { id: user.id, role }, method: "PATCH" });
  return `${user.email} の権限を変更しました。対象ユーザーの既存セッションは失効しました。`;
}

function useUserRowAction(user: ListedUser, onChanged: () => void): UserRowAction {
  const notify = useToast();
  const [confirming, setConfirming] = useState<RowOperation>();
  const [pending, setPending] = useState(false);
  const handleRoleChange = useCallback(() => {
    setConfirming("role");
  }, []);
  const handleDelete = useCallback(() => {
    setConfirming("delete");
  }, []);
  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setConfirming(undefined);
    }
  }, []);
  const handleConfirm = useCallback(() => {
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
  }, [confirming, notify, onChanged, user]);
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
