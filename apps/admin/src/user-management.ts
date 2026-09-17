import {
  RoleChanged,
  UserDeleted,
  UserList as UserListContract,
} from "@template/runtime/contracts";
import { useCallback, useEffect, useState } from "react";
import type { MouseEventHandler } from "react";
import { adminClient } from "#api-client.ts";
import { apiData } from "@template/runtime/client";
import { errorMessage } from "@template/ui";
import { usersPageSize } from "#users-pagination.ts";

type ManagedUser = (typeof UserListContract.Type)["users"][number];
interface UserList {
  readonly total: number;
  readonly users: readonly ManagedUser[];
}
type MutationMethod = "PATCH" | "DELETE";
type ReportFailure = (message: string) => void;

interface UserListState {
  readonly data: UserList | undefined;
  readonly handleNext: MouseEventHandler;
  readonly handlePrevious: MouseEventHandler;
  readonly offset: number;
  readonly reload: () => Promise<void>;
}

interface UserMutationState {
  readonly handleMutation: (user: ManagedUser, method: MutationMethod) => void;
  readonly message: string;
  readonly pending: boolean;
}

interface UserManagement extends UserListState, UserMutationState {
  readonly error: string;
}

async function fetchUsers(offset: number): Promise<UserList> {
  const query = { limit: usersPageSize, offset };
  return apiData(UserListContract, await adminClient().users.get({ query }));
}

function confirmationText(user: ManagedUser, method: MutationMethod): string {
  return method === "DELETE"
    ? `${user.email} を削除しますか？`
    : `${user.email} の権限を変更しますか？`;
}

async function mutateUser(user: ManagedUser, method: MutationMethod): Promise<void> {
  const { users } = adminClient();
  if (method === "DELETE") {
    apiData(UserDeleted, await users.delete({ id: user.id }));
    return;
  }
  const role = user.role === "admin" ? "user" : "admin";
  apiData(RoleChanged, await users.patch({ id: user.id, role }));
}

function useUserPaging(): Pick<UserListState, "handleNext" | "handlePrevious" | "offset"> {
  const [offset, setOffset] = useState(0);
  const handlePrevious = useCallback<MouseEventHandler>(() => {
    setOffset((current) => Math.max(0, current - usersPageSize));
  }, []);
  const handleNext = useCallback<MouseEventHandler>(() => {
    setOffset((current) => current + usersPageSize);
  }, []);
  return { handleNext, handlePrevious, offset };
}

function useUserList(authorized: boolean, reportFailure: ReportFailure): UserListState {
  const paging = useUserPaging();
  const { offset } = paging;
  const [data, setData] = useState<UserList>();
  const reload = useCallback(async (): Promise<void> => {
    try {
      setData(await fetchUsers(offset));
    } catch (error) {
      setData(undefined);
      reportFailure(errorMessage(error));
    }
  }, [offset, reportFailure]);
  useEffect(() => {
    const controller = { active: true };
    async function load(): Promise<void> {
      try {
        const users = await fetchUsers(offset);
        if (controller.active) {
          setData(users);
        }
      } catch (error) {
        if (controller.active) {
          setData(undefined);
          reportFailure(errorMessage(error));
        }
      }
    }
    if (authorized) {
      void load();
    }
    return (): void => {
      controller.active = false;
    };
  }, [authorized, offset, reportFailure]);
  return { ...paging, data, reload };
}

function useUserMutation(
  reload: () => Promise<void>,
  reportFailure: ReportFailure,
): UserMutationState {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const handleMutation = useCallback(
    (user: ManagedUser, method: MutationMethod): void => {
      // oxlint-disable-next-line no-alert
      if (!globalThis.confirm(confirmationText(user, method))) {
        return;
      }
      setPending(true);
      reportFailure("");
      setMessage("");
      async function update(): Promise<void> {
        try {
          await mutateUser(user, method);
          setMessage(
            method === "DELETE"
              ? "ユーザーを削除しました。"
              : "権限を変更しました。既存セッションは失効しました。",
          );
          await reload();
        } catch (error) {
          reportFailure(errorMessage(error));
        }
        setPending(false);
      }
      void update();
    },
    [reload, reportFailure],
  );
  return { handleMutation, message, pending };
}

function useUserManagement(authorized: boolean): UserManagement {
  const [failure, setFailure] = useState("");
  const list = useUserList(authorized, setFailure);
  const mutation = useUserMutation(list.reload, setFailure);
  return { ...list, ...mutation, error: failure };
}

export { useUserManagement };
export type { ManagedUser, MutationMethod, UserList, UserManagement };
