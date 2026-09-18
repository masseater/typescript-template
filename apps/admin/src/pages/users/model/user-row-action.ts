import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { RoleChanged, UserDeleted } from "@template/runtime/contracts";
import { failureMessage, request, useToast } from "@template/ui";
import type { ListedUser } from "./user-list.ts";
import { Option } from "effect";
import { adminClient } from "#shared/api/index.ts";
import { apiData } from "@template/runtime/client";
import { nextRoles } from "./user-labels.ts";
import { useAtom } from "@effect/atom-react";

type RowOperation = "delete" | "role";

interface UserRowAction {
  readonly handleConfirm: () => void;
  readonly handleDelete: () => void;
  readonly handleRoleChange: () => void;
  readonly confirming: RowOperation | undefined;
  readonly handleOpenChange: (open: boolean) => void;
  readonly pending: boolean;
}

interface Operation {
  readonly operation: RowOperation;
  readonly user: ListedUser;
}

async function perform({ operation, user }: Operation): Promise<string> {
  const { users } = adminClient();
  if (operation === "delete") {
    apiData(UserDeleted, await users.delete({ id: user.id }));
    return `${user.email} を削除しました。`;
  }
  const role = nextRoles[user.role];
  apiData(RoleChanged, await users.patch({ id: user.id, role }));
  return `${user.email} の権限を変更しました。対象ユーザーの既存セッションは失効しました。`;
}

const confirmingAtom = Atom.family((_userId: string) => Atom.make(Option.none<RowOperation>()));

const operationAtom = Atom.family((_userId: string) =>
  Atom.fn((operation: Operation) => request(async () => perform(operation))),
);

function useUserRowAction(user: ListedUser, onChanged: () => void): UserRowAction {
  const notify = useToast();
  const [confirming, setConfirming] = useAtom(confirmingAtom(user.id));
  const [operationResult, run] = useAtom(operationAtom(user.id), { mode: "promiseExit" });
  function handleRoleChange(): void {
    setConfirming(Option.some("role"));
  }
  function handleDelete(): void {
    setConfirming(Option.some("delete"));
  }
  function handleOpenChange(open: boolean): void {
    if (!open) {
      setConfirming(Option.none());
    }
  }
  async function execute(operation: RowOperation): Promise<void> {
    const exit = await run({ operation, user });
    const result = AsyncResult.fromExit(exit);
    if (AsyncResult.isSuccess(result)) {
      notify("success", result.value);
      onChanged();
    } else {
      notify("error", failureMessage(result));
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
    handleDelete,
    handleOpenChange,
    handleRoleChange,
    pending: operationResult.waiting,
  };
}

export { useUserRowAction };
