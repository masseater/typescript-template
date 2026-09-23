import { apiData } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";
import { MemberList } from "#shared/contracts/index.ts";

import type { UsersSearch } from "#pages/users/model/users-search.ts";

type Members = typeof MemberList.Type;

function loadMembers(search: UsersSearch): Promise<Members> {
  const query = {
    ...(search.keyword === undefined ? {} : { keyword: search.keyword }),
    page: String(search.page ?? 1),
  };
  return Promise.resolve(userClient()).then(({ api }) =>
    api.members.get({ query }).then((response) => apiData(MemberList, response)),
  );
}

export { loadMembers };
export type { Members };
