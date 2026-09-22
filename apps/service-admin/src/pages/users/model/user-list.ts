import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { errorMessage } from "@repo/auth-ui";
import { apiData } from "@repo/runtime/client";
import { formatWarekiDate, requestAtom, type RequestResult } from "@repo/ui";
import { Atom } from "effect/unstable/reactivity";

import { adminClient } from "#shared/api/index.ts";
import { UserList } from "#shared/contracts/index.ts";
import { userListQuery } from "./users-search.ts";

import type { UsersSearch } from "./users-search.ts";

interface ListedUser {
  readonly accountState: (typeof UserList.Type)["users"][number]["accountState"];
  readonly email: string;
  readonly emailVerified: boolean;
  readonly id: string;
  readonly name: string;
  readonly registeredOn: string;
  readonly twoFactorEnabled: boolean;
}

interface ListedUsers {
  readonly total: number;
  readonly users: readonly ListedUser[];
}

function listUsers(query: Readonly<Record<string, string>>): Promise<ListedUsers> {
  return adminClient()
    .users.get({ query })
    .then((response) => {
      const { total, users } = apiData(UserList, response);
      return {
        total,
        users: users.map(
          ({ accountState, createdAt, email, emailVerified, id, name, twoFactorEnabled }) => ({
            accountState,
            email,
            emailVerified,
            id,
            name,
            registeredOn: formatWarekiDate(createdAt),
            twoFactorEnabled,
          }),
        ),
      };
    })
    .catch((failure: unknown) => {
      throw new Error(errorMessage(failure));
    });
}

const userListAtom = Atom.family((query: Readonly<Record<string, string>>) =>
  requestAtom(() => listUsers(query)),
);

function useUserList(
  search: UsersSearch,
): Readonly<{ listing: RequestResult<ListedUsers>; reload: () => void }> {
  const atom = userListAtom(userListQuery(search));
  return { listing: useAtomValue(atom), reload: useAtomRefresh(atom) };
}

export { useUserList };
export type { ListedUser, ListedUsers };
