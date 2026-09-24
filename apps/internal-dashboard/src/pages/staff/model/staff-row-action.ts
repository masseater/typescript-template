import { apiData } from "@repo/runtime/client";
import { confirmedChange, type ConfirmedChange } from "@repo/ui";

import { wikiClient } from "#shared/api/index.ts";
import { StaffPermission, StaffPermissionChanged, StaffRemoved } from "#shared/contracts/index.ts";
import { isStaffPermission, staffPermissionLabels } from "./staff-labels.ts";

import type { ListedStaff } from "./staff-list.ts";

type RowOperation =
  | Readonly<{ kind: "permission"; permission: typeof StaffPermission.Type }>
  | Readonly<{ kind: "remove" }>;

interface StaffRowAction extends ConfirmedChange<RowOperation> {
  readonly handlePermissionChange: (permission: string) => void;
  readonly handleRemove: () => void;
}

function perform(member: ListedStaff, operation: RowOperation): Promise<string> {
  return Promise.resolve(wikiClient()).then(({ api: { staff } }) => {
    if (operation.kind === "permission") {
      return staff.patch({ id: member.id, permission: operation.permission }).then((response) => {
        const changed = apiData(StaffPermissionChanged, response);
        const label =
          changed.permission === undefined ? "未設定" : staffPermissionLabels[changed.permission];
        return `${member.email} の権限を「${label}」にしました。`;
      });
    }
    return staff.delete({ id: member.id }).then((response) => {
      apiData(StaffRemoved, response);
      return `${member.email} を削除しました。`;
    });
  });
}

const useStaffChange = confirmedChange(perform);

function useStaffRowAction(member: ListedStaff, onChanged: () => void): StaffRowAction {
  const change = useStaffChange(member, onChanged);
  function handlePermissionChange(permission: string): void {
    if (isStaffPermission(permission) && permission !== member.permission) {
      change.propose({ kind: "permission", permission });
    }
  }
  function handleRemove(): void {
    change.propose({ kind: "remove" });
  }
  return { ...change, handlePermissionChange, handleRemove };
}

export { useStaffRowAction };
export type { RowOperation };
