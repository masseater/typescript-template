import { apiData } from "@repo/runtime/client";
import { confirmedChange, type ConfirmedChange } from "@repo/ui";
import { Effect } from "effect";

import { adminClient } from "#shared/api/index.ts";
import {
  AdminPermission,
  AdminPermissionChanged,
  AdminStateChanged,
} from "#shared/contracts/index.ts";
import { adminPermissionLabels, adminStateLabels, isAdminPermission } from "./admin-labels.ts";

import type { ListedAdmin } from "./admin-list.ts";

type RowOperation =
  | Readonly<{ kind: "permission"; permission: typeof AdminPermission.Type }>
  | Readonly<{ kind: "state"; accountState: ListedAdmin["accountState"] }>;

interface AdminRowAction extends ConfirmedChange<RowOperation> {
  readonly handlePermissionChange: (permission: string) => void;
  readonly handleStateChange: (accountState: ListedAdmin["accountState"]) => void;
}

function perform(admin: ListedAdmin, operation: RowOperation): Effect.Effect<string> {
  return Effect.gen(function* performRowOperation() {
    const { admins } = adminClient();
    if (operation.kind === "permission") {
      const changed = apiData(
        AdminPermissionChanged,
        yield* Effect.promise(() =>
          admins.patch({ id: admin.id, permission: operation.permission }),
        ),
      );
      const label =
        changed.permission === undefined ? "未設定" : adminPermissionLabels[changed.permission];
      return `${admin.email} の権限を「${label}」にしました。`;
    }
    const changed = apiData(
      AdminStateChanged,
      yield* Effect.promise(() =>
        admins.state.patch({ accountState: operation.accountState, id: admin.id }),
      ),
    );
    return `${admin.email} を${adminStateLabels[changed.accountState]}にしました。`;
  });
}

const useAdminChange = confirmedChange((admin: ListedAdmin, operation: RowOperation) =>
  Effect.runPromise(perform(admin, operation)),
);

function useAdminRowAction(admin: ListedAdmin, onChanged: () => void): AdminRowAction {
  const change = useAdminChange(admin, onChanged);
  function handlePermissionChange(permission: string): void {
    if (isAdminPermission(permission) && permission !== admin.permission) {
      change.propose({ kind: "permission", permission });
    }
  }
  function handleStateChange(accountState: ListedAdmin["accountState"]): void {
    change.propose({ accountState, kind: "state" });
  }
  return { ...change, handlePermissionChange, handleStateChange };
}

export { useAdminRowAction };
export type { RowOperation };
