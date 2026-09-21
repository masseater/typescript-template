import { useAtom } from "@effect/atom-react";
import { apiData } from "@repo/runtime/client";
import { STATUS_VARIANT, localState, request, resultError, useToast } from "@repo/ui";
import { Option } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";

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
  const {
    api: { staff },
  } = await wikiClient();
  if (operation.kind === "permission") {
    const changed = apiData(
      StaffPermissionChanged,
      await staff.patch({ id: member.id, permission: operation.permission }),
    );
    const label =
      changed.permission === undefined ? "未設定" : staffPermissionLabels[changed.permission];
    return `${member.email} の権限を「${label}」にしました。`;
  }
  apiData(StaffRemoved, await staff.delete({ id: member.id }));
  return `${member.email} を削除しました。`;
}

const useRowConfirming = localState(Option.none<RowOperation>());

const changeAtom = Atom.family((staffId: string) => {
  void staffId;
  return Atom.fn(
    ({ member, operation }: Readonly<{ member: ListedStaff; operation: RowOperation }>) =>
      request(async () => perform(member, operation)),
  );
});

function useStaffRowAction(member: ListedStaff, onChanged: () => void): StaffRowAction {
  const notify = useToast();
  const [confirming, setConfirming] = useRowConfirming();
  const [changeState, run] = useAtom(changeAtom(member.id), { mode: "promiseExit" });
  function handlePermissionChange(permission: string): void {
    if (isStaffPermission(permission) && permission !== member.permission) {
      setConfirming(Option.some({ kind: "permission", permission }));
    }
  }
  function handleRemove(): void {
    setConfirming(Option.some({ kind: "remove" }));
  }
  function handleOpenChange(open: boolean): void {
    if (!open) {
      setConfirming(Option.none());
    }
  }
  async function execute(operation: RowOperation): Promise<void> {
    const change = AsyncResult.fromExit(await run({ member, operation }));
    if (AsyncResult.isSuccess(change)) {
      notify(STATUS_VARIANT.success, change.value);
      onChanged();
      return;
    }
    const failure = resultError(change);
    if (failure !== undefined) {
      notify(STATUS_VARIANT.failure, failure);
    }
  }
  function handleConfirm(): void {
    if (Option.isNone(confirming)) {
      return;
    }
    setConfirming(Option.none());
    void execute(confirming.value);
  }
  return {
    confirming: Option.getOrUndefined(confirming),
    handleConfirm,
    handleOpenChange,
    handlePermissionChange,
    handleRemove,
    pending: changeState.waiting,
  };
}

export { useStaffRowAction };
export type { RowOperation };
