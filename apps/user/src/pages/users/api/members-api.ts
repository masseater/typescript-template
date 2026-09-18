import { MemberList } from "@template/runtime/contracts";
import type { UsersSearch } from "#pages/users/model/users-search.ts";
import { apiData } from "@template/runtime/client";
import { infiniteQueryOptions } from "@tanstack/react-query";
import { nextMemberPage } from "#pages/users/model/member-pages.ts";
import { userClient } from "#shared/api/index.ts";

type Members = typeof MemberList.Type;

async function loadMembers(keyword: string | undefined, page: number): Promise<Members> {
  const { api } = await userClient();
  const query = { ...(keyword === undefined ? {} : { keyword }), page: String(page) };
  return apiData(MemberList, await api.members.get({ query }));
}

function membersOptions(search: UsersSearch) {
  return infiniteQueryOptions({
    getNextPageParam: (last: Members, pages: readonly Members[]) =>
      nextMemberPage(pages.length, last.total),
    initialPageParam: 1,
    queryFn: async ({ pageParam }: Readonly<{ pageParam: number }>) =>
      loadMembers(search.keyword, pageParam),
    queryKey: ["members", search.keyword ?? ""],
  });
}

export { membersOptions };
