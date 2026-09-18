import { apiData } from "@template/runtime/client";
import { UserList } from "@template/runtime/contracts";
import { errorMessage } from "@template/ui";
import { useEffect, useState } from "react";

import { adminClient } from "#shared/api/index.ts";
import { userListQuery, type UsersSearch } from "./users-search.ts";

type ListedUser = {
  readonly email: string;
  readonly emailVerified: boolean;
  readonly id: string;
  readonly name: string;
  readonly registeredOn: string;
  readonly role: (typeof UserList.Type)["users"][number]["role"];
  readonly twoFactorEnabled: boolean;
};

type ListedUsers = {
  readonly total: number;
  readonly users: readonly ListedUser[];
};

type UserListState =
  | Readonly<{ list: ListedUsers; status: "loaded" }>
  | Readonly<{ message: string; status: "failed" }>
  | Readonly<{ status: "loading" }>;

type Outcome = {
  readonly attempt: number;
  readonly path: string;
  readonly state: UserListState;
};

const registeredDate = new Intl.DateTimeFormat("ja-JP", {
  day: "numeric",
  month: "numeric",
  timeZone: "Asia/Tokyo",
  year: "numeric",
});

const fetchUsers = async (query: Readonly<Record<string, string>>): Promise<UserListState> => {
  try {
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
    return { list: { total, users: listed }, status: "loaded" };
  } catch (error) {
    return { message: errorMessage(error), status: "failed" };
  }
};

const useUserList = (
  search: UsersSearch,
): Readonly<{ reload: () => void; state: UserListState }> => {
  const query = userListQuery(search);
  const path = new URLSearchParams(query).toString();
  const [attempt, setAttempt] = useState(0);
  const [outcome, setOutcome] = useState<Outcome>();
  useEffect(() => {
    const controller = { active: true };
    const load = async (): Promise<void> => {
      const state = await fetchUsers(query);
      if (controller.active) {
        setOutcome({ attempt, path, state });
      }
    };
    void load();
    return (): void => {
      controller.active = false;
    };
  }, [attempt, path, query]);
  const reload = (): void => {
    setAttempt((current) => current + 1);
  };
  const current = outcome?.path === path && outcome.attempt === attempt;
  return { reload, state: current ? outcome.state : { status: "loading" } };
};

export { useUserList };
export type { ListedUser, ListedUsers, UserListState };
