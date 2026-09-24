import { useQuery, useQueryClient } from "@tanstack/react-query";

import { userListKey, userListOptions } from "../api/list-users.ts";
import { listUsers } from "../api/load-users.ts";
import { userListQuery } from "./users-search.ts";

import type { ListedUsers } from "../api/load-users.ts";
import type { UsersSearch } from "./users-search.ts";

interface UserListState {
  readonly data: ListedUsers | undefined;
  readonly error: string | undefined;
}

function useUserList(search: UsersSearch): Readonly<{ list: UserListState; reload: () => void }> {
  const queries = useQueryClient();
  const query = userListQuery(search);
  const list = useQuery(userListOptions(query, () => listUsers(query)));
  const reload = (): void => {
    void queries.invalidateQueries({ queryKey: userListKey });
  };
  return {
    list: {
      data: list.data,
      error: list.isError ? list.error.message : undefined,
    },
    reload,
  };
}

export { useUserList };
export type { ListedUser, ListedUsers } from "../api/load-users.ts";
