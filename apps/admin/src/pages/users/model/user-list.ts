import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { Atom } from "effect/unstable/reactivity";
import type { ListedUsers } from "#pages/users/api/list-users.ts";
import type { RequestResult } from "@template/ui";
import type { UsersSearch } from "./users-search.ts";
import { listUsers } from "#pages/users/api/list-users.ts";
import { requestAtom } from "@template/ui";
import { userListQuery } from "./users-search.ts";

const userListAtom = Atom.family((query: Readonly<Record<string, string>>) =>
  requestAtom(async () => listUsers(query)),
);

function useUserList(
  search: UsersSearch,
): Readonly<{ reload: () => void; result: RequestResult<ListedUsers> }> {
  const atom = userListAtom(userListQuery(search));
  return { reload: useAtomRefresh(atom), result: useAtomValue(atom) };
}

export { useUserList };
