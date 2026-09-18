import { apiData } from "@template/runtime/client";
import { RoleChanged, UserDeleted } from "@template/runtime/contracts";
import { errorMessage, useToast } from "@template/ui";
import { useState } from "react";

import { adminClient } from "#shared/api/index.ts";
import { nextRoles } from "./user-labels.ts";

import type { ListedUser } from "./user-list.ts";

type RowOperation = "delete" | "role";

type UserRowAction = {
  readonly handleConfirm: () => void;
  readonly handleDelete: () => void;
  readonly handleRoleChange: () => void;
  readonly confirming: RowOperation | undefined;
  readonly handleOpenChange: (open: boolean) => void;
  readonly pending: boolean;
};

const perform = async (user: ListedUser, operation: RowOperation): Promise<string> => {
  const { users } = adminClient();
  if (operation === "delete") {
    apiData(UserDeleted, await users.delete({ id: user.id }));
    return `${user.email} を削除しました。`;
  }
  const role = nextRoles[user.role];
  apiData(RoleChanged, await users.patch({ id: user.id, role }));
  return `${user.email} の権限を変更しました。対象ユーザーの既存セッションは失効しました。`;
};

const useUserRowAction = (user: ListedUser, onChanged: () => void): UserRowAction => {
  const notify = useToast();
  const [confirming, setConfirming] = useState<RowOperation>();
  const [pending, setPending] = useState(false);
  const handleRoleChange = (): void => {
    setConfirming("role");
  };
  const handleDelete = (): void => {
    setConfirming("delete");
  };
  const handleOpenChange = (open: boolean): void => {
    if (!open) {
      setConfirming(undefined);
    }
  };
  const handleConfirm = (): void => {
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
  };
  return {
    confirming,
    handleConfirm,
    handleDelete,
    handleOpenChange,
    handleRoleChange,
    pending,
  };
};

export { useUserRowAction };
