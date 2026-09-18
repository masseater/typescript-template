import { request, serverQuery, useRefresh, useServerQuery } from "@template/ui";
import type { ServerQuery, ServerQueryResult } from "@template/ui";
import { UserList } from "@template/runtime/contracts";
import type { UsersSearch } from "./users-search.ts";
import { adminClient } from "#shared/api/index.ts";
import { apiData } from "@template/runtime/client";
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

type UserListResult = ServerQueryResult<ListedUsers>;

const userListKey = ["admin-users"];

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

function usersQuery(query: Readonly<Record<string, string>>): ServerQuery<ListedUsers> {
  return serverQuery([...userListKey, query], request(async () => fetchUsers(query)));
}

function useUserList(
  search: UsersSearch,
): Readonly<{ reload: () => void; result: UserListResult }> {
  const refresh = useRefresh();
  return {
    reload: () => {
      refresh(userListKey);
    },
    result: useServerQuery(usersQuery(userListQuery(search))),
  };
}

export { useUserList };
export type { ListedUser, ListedUsers, UserListResult };
