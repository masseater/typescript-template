import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { localState, request, resultError, useToast } from "@template/ui";
import type { ListedUser } from "#pages/users/api/list-users.ts";
import { Option } from "effect";
import type { UserChange } from "#pages/users/api/change-user.ts";
import { changeUser } from "#pages/users/api/change-user.ts";
import { useAtom } from "@effect/atom-react";

interface UserRowAction {
  readonly handleConfirm: () => void;
  readonly handleDelete: () => void;
  readonly handleRoleChange: () => void;
  readonly confirming: UserChange | undefined;
  readonly handleOpenChange: (open: boolean) => void;
  readonly pending: boolean;
}

const useConfirming = localState(Option.none<UserChange>());

const changeAtom = Atom.family((_userId: string) =>
  Atom.fn(({ change, user }: Readonly<{ change: UserChange; user: ListedUser }>) =>
    request(async () => changeUser(user, change)),
  ),
);

function useUserRowAction(user: ListedUser, onChanged: () => void): UserRowAction {
  const notify = useToast();
  const [confirming, setConfirming] = useConfirming();
  const [changeResult, run] = useAtom(changeAtom(user.id), { mode: "promiseExit" });
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
  async function execute(change: UserChange): Promise<void> {
    const result = AsyncResult.fromExit(await run({ change, user }));
    if (AsyncResult.isSuccess(result)) {
      notify("success", result.value);
      onChanged();
      return;
    }
    const error = resultError(result);
    if (error !== undefined) {
      notify("error", error);
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
    pending: changeResult.waiting,
  };
}

export { useUserRowAction };
