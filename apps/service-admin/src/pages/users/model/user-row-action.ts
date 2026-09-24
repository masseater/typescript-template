import { apiData } from "@repo/runtime/client";
import { confirmedChange, type ConfirmedChange } from "@repo/ui";
import { Effect } from "effect";

import { adminClient } from "#shared/api/index.ts";
import { MemberStateChanged, UserDeleted, nextAccountStates } from "#shared/contracts/index.ts";
import { accountStateLabels } from "./user-labels.ts";

import type { ListedUser } from "./user-list.ts";

type RowOperation = "delete" | "state";

interface UserRowAction extends ConfirmedChange<RowOperation> {
  readonly handleDelete: () => void;
  readonly handleStateChange: () => void;
}

function perform(user: ListedUser, operation: RowOperation): Effect.Effect<string> {
  return Effect.gen(function* performRowOperation() {
    const { users } = adminClient();
    if (operation === "delete") {
      apiData(UserDeleted, yield* Effect.promise(() => users.delete({ id: user.id })));
      return `${user.email} を削除しました。`;
    }
    const accountState = nextAccountStates[user.accountState];
    const changed = apiData(
      MemberStateChanged,
      yield* Effect.promise(() => users.patch({ accountState, id: user.id })),
    );
    return `${user.email} を${accountStateLabels[changed.accountState]}にしました。`;
  });
}

const useUserChange = confirmedChange((user: ListedUser, operation: RowOperation) =>
  Effect.runPromise(perform(user, operation)),
);

function useUserRowAction(user: ListedUser, onChanged: () => void): UserRowAction {
  const change = useUserChange(user, onChanged);
  function handleStateChange(): void {
    change.propose("state");
  }
  function handleDelete(): void {
    change.propose("delete");
  }
  return { ...change, handleDelete, handleStateChange };
}

export { useUserRowAction };
