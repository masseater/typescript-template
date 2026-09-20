import { errorMessage } from "@repo/auth-ui";
import { apiData } from "@repo/runtime/client";
import { STATUS_VARIANT, useToast } from "@repo/ui";
import { useState } from "react";

import { adminClient } from "#shared/api/index.ts";
import { MemberStateChanged, UserDeleted } from "#shared/contracts/index.ts";
import { accountStateLabels, nextAccountStates } from "./user-labels.ts";

import type { ListedUser } from "./user-list.ts";

type RowOperation = "delete" | "state";

interface UserRowAction {
  readonly handleConfirm: () => void;
  readonly handleDelete: () => void;
  readonly handleStateChange: () => void;
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
  const accountState = nextAccountStates[user.accountState];
  const changed = apiData(MemberStateChanged, await users.patch({ accountState, id: user.id }));
  return `${user.email} を${accountStateLabels[changed.accountState]}にしました。`;
}

function useUserRowAction(user: ListedUser, onChanged: () => void): UserRowAction {
  const notify = useToast();
  const [confirming, setConfirming] = useState<RowOperation>();
  const [pending, setPending] = useState(false);
  function handleStateChange(): void {
    setConfirming("state");
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
        notify(STATUS_VARIANT.success, await perform(user, operation));
        onChanged();
      } catch (error) {
        notify(STATUS_VARIANT.failure, errorMessage(error));
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
    handleStateChange,
    pending,
  };
}

export { useUserRowAction };
