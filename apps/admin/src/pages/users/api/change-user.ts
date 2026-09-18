import { RoleChanged, UserDeleted } from "@template/runtime/contracts";
import type { ListedUser } from "./list-users.ts";
import { adminClient } from "#shared/api/index.ts";
import { apiData } from "@template/runtime/client";
import { nextRoles } from "#pages/users/model/user-labels.ts";

type UserChange = "delete" | "role";

async function changeUser(user: ListedUser, change: UserChange): Promise<string> {
  const { users } = adminClient();
  if (change === "delete") {
    apiData(UserDeleted, await users.delete({ id: user.id }));
    return `${user.email} を削除しました。`;
  }
  const role = nextRoles[user.role];
  apiData(RoleChanged, await users.patch({ id: user.id, role }));
  return `${user.email} の権限を変更しました。対象ユーザーの既存セッションは失効しました。`;
}

export { changeUser };
export type { UserChange };
