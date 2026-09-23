import { useAtom } from "@effect/atom-react";
import { apiData } from "@repo/runtime/client";
import { localState, request, resultError, useToast } from "@repo/ui";
import { Effect, Exit, Option } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";

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

const isAdminPermission = (value: string): value is typeof AdminPermission.Type =>
  AdminPermission.literals.some((permission) => permission === value);

const useRowConfirming = localState(Option.none<RowOperation>());

const changeAtom = Atom.family((adminId: string) => {
  void adminId;
  return Atom.fn(
    ({ admin, operation }: Readonly<{ admin: ListedAdmin; operation: RowOperation }>) =>
      request(() => Effect.runPromise(perform(admin, operation))),
  );
});

function executeChange(
  run: (
    input: Readonly<{ admin: ListedAdmin; operation: RowOperation }>,
  ) => Promise<Exit.Exit<string, unknown>>,
  notify: (kind: "success" | "error", message: string) => void,
  onChanged: () => void,
  admin: ListedAdmin,
  operation: RowOperation,
): Promise<void> {
  return Effect.runPromise(
    Effect.gen(function* executeRowOperation() {
      const change = AsyncResult.fromExit(yield* Effect.promise(() => run({ admin, operation })));
      if (AsyncResult.isSuccess(change)) {
        notify("success", change.value);
        onChanged();
        return;
      }
      const failure = resultError(change);
      if (failure !== undefined) {
        notify("error", failure);
      }
    }),
  );
}

function useAdminRowAction(admin: ListedAdmin, onChanged: () => void): AdminRowAction {
  const notify = useToast();
  const [confirming, setConfirming] = useRowConfirming();
  const [changeState, run] = useAtom(changeAtom(admin.id), { mode: "promiseExit" });
  function handlePermissionChange(permission: string): void {
    if (isAdminPermission(permission) && permission !== admin.permission) {
      setConfirming(Option.some({ kind: "permission", permission }));
    }
  }
  function handleStateChange(accountState: ListedAdmin["accountState"]): void {
    setConfirming(Option.some({ accountState, kind: "state" }));
  }
  function handleOpenChange(open: boolean): void {
    if (!open) {
      setConfirming(Option.none());
    }
  }
  function execute(operation: RowOperation): void {
    void executeChange(run, notify, onChanged, admin, operation);
  }
  function handleConfirm(): void {
    if (Option.isNone(confirming)) {
      return;
    }
    setConfirming(Option.none());
    execute(confirming.value);
  }
  return {
    confirming: Option.getOrUndefined(confirming),
    handleConfirm,
    handleOpenChange,
    handlePermissionChange,
    handleStateChange,
    pending: changeState.waiting,
  };
}

export { useAdminRowAction };
export type { RowOperation };
