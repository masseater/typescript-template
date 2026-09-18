import type { UsersSearch } from "#pages/users/model/users-search.ts";
import { userClient } from "#shared/api/index.ts";
import { apiData } from "@repo/runtime/client";
import { MemberList } from "@repo/runtime/contracts";

type Members = typeof MemberList.Type;

async function loadMembers(search: UsersSearch): Promise<Members> {
  const { api } = await userClient();
  const query = {
    ...(search.keyword === undefined ? {} : { keyword: search.keyword }),
    page: String(search.page ?? 1),
  };
  return apiData(MemberList, await api.members.get({ query }));
}

export { loadMembers };
export type { Members };
