import { errorMessage } from "@repo/auth-ui";
import { apiData } from "@repo/runtime/client";
import { STATUS_VARIANT, useToast } from "@repo/ui";
import { useState } from "react";

import { wikiClient } from "#shared/api/index.ts";
import { StaffPermission, StaffPermissionChanged, StaffRemoved } from "#shared/contracts/index.ts";
import { isStaffPermission, staffPermissionLabels } from "./staff-labels.ts";

import type { ListedStaff } from "./staff-list.ts";

type RowOperation =
  | Readonly<{ kind: "permission"; permission: typeof StaffPermission.Type }>
  | Readonly<{ kind: "remove" }>;

interface StaffRowAction {
  readonly confirming: RowOperation | undefined;
  readonly handleConfirm: () => void;
  readonly handleOpenChange: (open: boolean) => void;
  readonly handlePermissionChange: (permission: string) => void;
  readonly handleRemove: () => void;
  readonly pending: boolean;
}

async function perform(member: ListedStaff, operation: RowOperation): Promise<string> {
  const { staff } = wikiClient();
  if (operation.kind === "permission") {
    const changed = apiData(
      StaffPermissionChanged,
      await staff.patch({ id: member.id, permission: operation.permission }),
    );
    const label =
      changed.permission === null ? "未設定" : staffPermissionLabels[changed.permission];
    return `${member.email} の権限を「${label}」にしました。`;
  }
  apiData(StaffRemoved, await staff.delete({ id: member.id }));
  return `${member.email} を削除しました。`;
}

function useStaffRowAction(member: ListedStaff, onChanged: () => void): StaffRowAction {
  const notify = useToast();
  const [confirming, setConfirming] = useState<RowOperation>();
  const [pending, setPending] = useState(false);
  function handlePermissionChange(permission: string): void {
    if (isStaffPermission(permission) && permission !== member.permission) {
      setConfirming({ kind: "permission", permission });
    }
  }
  function handleRemove(): void {
    setConfirming({ kind: "remove" });
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
        notify(STATUS_VARIANT.success, await perform(member, operation));
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
    handleRemove,
    pending,
  };
}

export { useStaffRowAction };
export type { RowOperation };
