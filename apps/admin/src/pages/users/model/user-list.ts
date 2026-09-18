import { request, serverQuery, useRefresh, useServerQuery } from "@template/ui";
import type { ListedUsers } from "#pages/users/api/list-users.ts";
import type { ServerQueryResult } from "@template/ui";
import type { UsersSearch } from "./users-search.ts";
import { listUsers } from "#pages/users/api/list-users.ts";
import { userListQuery } from "./users-search.ts";

const userListKey = ["admin-users"];

function useUserList(
  search: UsersSearch,
): Readonly<{ reload: () => void; result: ServerQueryResult<ListedUsers> }> {
  const refresh = useRefresh();
  const query = userListQuery(search);
  return {
    reload: () => {
      refresh(userListKey);
    },
    result: useServerQuery(
      serverQuery(
        [...userListKey, query],
        request(async () => listUsers(query)),
      ),
    ),
  };
}

export { useUserList };
