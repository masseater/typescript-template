import { absence, readApi } from "#shared/api/index.ts";
import { MemberList } from "@template/runtime/contracts";
import type { UsersSearch } from "#pages/users/model/users-search.ts";

type Members = typeof MemberList.Type;

async function loadMembers(search: UsersSearch): Promise<Members> {
  const query = new URLSearchParams({
    ...(search.keyword === undefined ? {} : { keyword: search.keyword }),
    page: String(search.page ?? 1),
  });
  const members = await readApi(`/api/members?${query.toString()}`, MemberList, absence.notFound);
  if (members === undefined) {
    throw new Error("ユーザー一覧を取得できませんでした。");
  }
  return members;
}

export { loadMembers };
export type { Members };
