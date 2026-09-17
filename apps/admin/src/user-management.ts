import {
  RoleChanged,
  UserDeleted,
  UserList as UserListContract,
} from "@template/runtime/contracts";
import { useEffect, useState } from "react";
import type { MouseEventHandler } from "react";
import { errorMessage } from "@template/ui";
import { requestJson } from "@template/runtime/client";
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
  return requestJson(`/api/users?limit=${usersPageSize}&offset=${offset}`, UserListContract);
}

function confirmationText(user: ManagedUser, method: MutationMethod): string {
  return method === "DELETE"
    ? `${user.email} を削除しますか？`
    : `${user.email} の権限を変更しますか？`;
}

function mutationBody(user: ManagedUser, method: MutationMethod): Readonly<Record<string, string>> {
  return method === "DELETE"
    ? { id: user.id }
    : { id: user.id, role: user.role === "admin" ? "user" : "admin" };
}

function useUserPaging(): Pick<UserListState, "handleNext" | "handlePrevious" | "offset"> {
  const [offset, setOffset] = useState(0);
  function handlePrevious(): void {
    setOffset((current) => Math.max(0, current - usersPageSize));
  }
  function handleNext(): void {
    setOffset((current) => current + usersPageSize);
  }
  return { handleNext, handlePrevious, offset };
}

function useUserList(authorized: boolean, reportFailure: ReportFailure): UserListState {
  const paging = useUserPaging();
  const { offset } = paging;
  const [data, setData] = useState<UserList>();
  async function reload(): Promise<void> {
    try {
      setData(await fetchUsers(offset));
    } catch (error) {
      setData(undefined);
      reportFailure(errorMessage(error));
    }
  }
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
  function handleMutation(user: ManagedUser, method: MutationMethod): void {
    // oxlint-disable-next-line no-alert
    if (!globalThis.confirm(confirmationText(user, method))) {
      return;
    }
    setPending(true);
    reportFailure("");
    setMessage("");
    async function update(): Promise<void> {
      try {
        await (method === "DELETE"
          ? requestJson("/api/users", UserDeleted, { body: mutationBody(user, method), method })
          : requestJson("/api/users", RoleChanged, { body: mutationBody(user, method), method }));
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
  }
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
