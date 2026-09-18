import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import type { AsyncResult } from "effect/unstable/reactivity";
import { Atom } from "effect/unstable/reactivity";
import { UserList } from "@template/runtime/contracts";
import type { UsersSearch } from "./users-search.ts";
import { adminClient } from "#shared/api/index.ts";
import { apiData } from "@template/runtime/client";
import { request } from "@template/ui";
import { userListQuery } from "./users-search.ts";

const registeredDate = new Intl.DateTimeFormat("ja-JP", {
  day: "numeric",
  month: "numeric",
  timeZone: "Asia/Tokyo",
  year: "numeric",
});

interface ListedUser {
  readonly email: string;
  readonly emailVerified: boolean;
  readonly id: string;
  readonly name: string;
  readonly registeredOn: string;
  readonly role: (typeof UserList.Type)["users"][number]["role"];
  readonly twoFactorEnabled: boolean;
}

interface ListedUsers {
  readonly total: number;
  readonly users: readonly ListedUser[];
}

type UserListResult = AsyncResult.AsyncResult<ListedUsers, Readonly<{ message: string }>>;

async function fetchUsers(query: Readonly<Record<string, string>>): Promise<ListedUsers> {
  const { total, users } = apiData(UserList, await adminClient().users.get({ query }));
  const listed = users.map(
    ({ createdAt, email, emailVerified, id, name, role, twoFactorEnabled }) => ({
      email,
      emailVerified,
      id,
      name,
      registeredOn: registeredDate.format(createdAt),
      role,
      twoFactorEnabled,
    }),
  );
  return { total, users: listed };
}

const userListAtom = Atom.family((query: Readonly<Record<string, string>>) =>
  Atom.make(request(async () => fetchUsers(query))).pipe(Atom.withServerValueInitial),
);

function useUserList(
  search: UsersSearch,
): Readonly<{ reload: () => void; result: UserListResult }> {
  const atom = userListAtom(userListQuery(search));
  return { reload: useAtomRefresh(atom), result: useAtomValue(atom) };
}

export { useUserList };
export type { ListedUser, ListedUsers, UserListResult };
