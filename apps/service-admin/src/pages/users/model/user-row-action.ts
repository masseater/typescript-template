import { useAtom } from "@effect/atom-react";
import { apiData } from "@repo/runtime/client";
import { localState, request, resultError, useToast } from "@repo/ui";
import { Effect, Exit, Option } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";

import { adminClient } from "#shared/api/index.ts";
import { RoleChanged, UserDeleted } from "#shared/contracts/index.ts";
import { nextRoles } from "./user-labels.ts";

import type { ListedUser } from "./user-list.ts";

type RowOperation = "delete" | "role";

interface UserRowAction {
  readonly handleConfirm: () => void;
  readonly handleDelete: () => void;
  readonly handleRoleChange: () => void;
  readonly confirming: RowOperation | undefined;
  readonly handleOpenChange: (open: boolean) => void;
  readonly pending: boolean;
}

function perform(user: ListedUser, operation: RowOperation): Effect.Effect<string> {
  return Effect.gen(function* performRowOperation() {
    const { users } = adminClient();
    if (operation === "delete") {
      apiData(UserDeleted, yield* Effect.promise(() => users.delete({ id: user.id })));
      return `${user.email} を削除しました。`;
    }
    const role = nextRoles[user.role];
    apiData(RoleChanged, yield* Effect.promise(() => users.patch({ id: user.id, role })));
    return `${user.email} の権限を変更しました。対象ユーザーの既存セッションは失効しました。`;
  });
}

const useRowConfirming = localState(Option.none<RowOperation>());

const changeAtom = Atom.family((userId: string) => {
  void userId;
  return Atom.fn(({ operation, user }: Readonly<{ operation: RowOperation; user: ListedUser }>) =>
    request(() => Effect.runPromise(perform(user, operation))),
  );
});

function executeChange(
  run: (
    input: Readonly<{ operation: RowOperation; user: ListedUser }>,
  ) => Promise<Exit.Exit<string, unknown>>,
  notify: (kind: "success" | "error", message: string) => void,
  onChanged: () => void,
  operation: RowOperation,
  user: ListedUser,
): Promise<void> {
  return Effect.runPromise(
    Effect.gen(function* executeRowOperation() {
      const change = AsyncResult.fromExit(yield* Effect.promise(() => run({ operation, user })));
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

function useUserRowAction(user: ListedUser, onChanged: () => void): UserRowAction {
  const notify = useToast();
  const [confirming, setConfirming] = useRowConfirming();
  const [changeState, run] = useAtom(changeAtom(user.id), { mode: "promiseExit" });
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
  function execute(operation: RowOperation): void {
    void executeChange(run, notify, onChanged, operation, user);
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
    handleDelete,
    handleOpenChange,
    handleRoleChange,
    pending: changeState.waiting,
  };
}

export { useUserRowAction };
