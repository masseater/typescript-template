import { errorMessage } from "@repo/auth-ui";
import { apiData } from "@repo/runtime/client";
import { STATUS_VARIANT, useToast } from "@repo/ui";
import { useState } from "react";

import { adminClient } from "#shared/api/index.ts";
import {
  AdminPermission,
  AdminPermissionChanged,
  AdminStateChanged,
} from "#shared/contracts/index.ts";
import { adminPermissionLabels, adminStateLabels } from "./admin-labels.ts";

import type { ListedAdmin } from "./admin-list.ts";

type RowOperation =
  | Readonly<{ kind: "permission"; permission: typeof AdminPermission.Type }>
  | Readonly<{ kind: "state"; accountState: ListedAdmin["accountState"] }>;

interface AdminRowAction {
  readonly confirming: RowOperation | undefined;
  readonly handleConfirm: () => void;
  readonly handleOpenChange: (open: boolean) => void;
  readonly handlePermissionChange: (permission: string) => void;
  readonly handleStateChange: (accountState: ListedAdmin["accountState"]) => void;
  readonly pending: boolean;
}

async function perform(admin: ListedAdmin, operation: RowOperation): Promise<string> {
  const { admins } = adminClient();
  if (operation.kind === "permission") {
    const changed = apiData(
      AdminPermissionChanged,
      await admins.patch({ id: admin.id, permission: operation.permission }),
    );
    const label =
      changed.permission === undefined ? "未設定" : adminPermissionLabels[changed.permission];
    return `${admin.email} の権限を「${label}」にしました。`;
  }
  const changed = apiData(
    AdminStateChanged,
    await admins.state.patch({ accountState: operation.accountState, id: admin.id }),
  );
  return `${admin.email} を${adminStateLabels[changed.accountState]}にしました。`;
}

const isAdminPermission = (value: string): value is typeof AdminPermission.Type =>
  AdminPermission.literals.some((permission) => permission === value);

function useAdminRowAction(admin: ListedAdmin, onChanged: () => void): AdminRowAction {
  const notify = useToast();
  const [confirming, setConfirming] = useState<RowOperation>();
  const [pending, setPending] = useState(false);
  function handlePermissionChange(permission: string): void {
    if (isAdminPermission(permission) && permission !== admin.permission) {
      setConfirming({ kind: "permission", permission });
    }
  }
  function handleStateChange(accountState: ListedAdmin["accountState"]): void {
    setConfirming({ accountState, kind: "state" });
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
        notify(STATUS_VARIANT.success, await perform(admin, operation));
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
    handleOpenChange,
    handlePermissionChange,
    handleStateChange,
    pending,
  };
}

export { useAdminRowAction };
export type { RowOperation };
