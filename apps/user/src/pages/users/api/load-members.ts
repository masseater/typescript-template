import { apiData } from "@template/runtime/client";
import { MemberList } from "@template/runtime/contracts";

import { userClient } from "#shared/api/index.ts";

import type { UsersSearch } from "#pages/users/model/users-search.ts";

type Members = typeof MemberList.Type;

const loadMembers = async (search: UsersSearch): Promise<Members> => {
  const { api } = await userClient();
  const query = {
    ...(search.keyword === undefined ? {} : { keyword: search.keyword }),
    page: String(search.page ?? 1),
  };
  return apiData(MemberList, await api.members.get({ query }));
};

export { loadMembers };
export type { Members };
