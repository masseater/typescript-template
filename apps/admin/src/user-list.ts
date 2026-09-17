import { useCallback, useEffect, useState } from "react";
import { UserList } from "@template/runtime/contracts";
import type { UsersSearch } from "#users-search.ts";
import { adminClient } from "#api-client.ts";
import { apiData } from "@template/runtime/client";
import { errorMessage } from "@template/ui";
import { userListQuery } from "#users-search.ts";

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

type UserListState =
  | Readonly<{ list: ListedUsers; status: "loaded" }>
  | Readonly<{ message: string; status: "failed" }>
  | Readonly<{ status: "loading" }>;

interface Outcome {
  readonly attempt: number;
  readonly path: string;
  readonly state: UserListState;
}

async function fetchUsers(query: Readonly<Record<string, string>>): Promise<UserListState> {
  try {
    const { total, users } = apiData(UserList, await adminClient().users.get({ query }));
    const listed = users.map(
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
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
}

function useUserList(search: UsersSearch): Readonly<{ reload: () => void; state: UserListState }> {
  const path = new URLSearchParams(userListQuery(search)).toString();
  const [attempt, setAttempt] = useState(0);
  const [outcome, setOutcome] = useState<Outcome>();
  useEffect(() => {
    const controller = { active: true };
    async function load(): Promise<void> {
      const state = await fetchUsers(Object.fromEntries(new URLSearchParams(path)));
      if (controller.active) {
        setOutcome({ attempt, path, state });
      }
    }
    void load();
    return (): void => {
      controller.active = false;
    };
  }, [attempt, path]);
  const reload = useCallback(() => {
    setAttempt((current) => current + 1);
  }, []);
  const current = outcome?.path === path && outcome.attempt === attempt;
  return { reload, state: current ? outcome.state : { status: "loading" } };
}

export { useUserList };
export type { ListedUser, ListedUsers, UserListState };
