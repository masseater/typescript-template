import { MemberList } from "@template/runtime/contracts";
import type { UsersSearch } from "#pages/users/model/users-search.ts";
import { readApi } from "#shared/api/index.ts";

type Members = typeof MemberList.Type;

async function loadMembers(search: UsersSearch): Promise<Members> {
  const query = new URLSearchParams({
    ...(search.keyword === undefined ? {} : { keyword: search.keyword }),
    page: String(search.page ?? 1),
  });
  return readApi(`/api/members?${query.toString()}`, MemberList);
}

export { loadMembers };
export type { Members };
