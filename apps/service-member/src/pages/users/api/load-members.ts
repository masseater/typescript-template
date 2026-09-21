import { httpStatus } from "@repo/observability/http-status";
import { apiData } from "@repo/runtime/client";
import { infiniteQueryOptions } from "@tanstack/react-query";

import { userClient } from "#shared/api/index.ts";
import { MemberList } from "#shared/contracts/index.ts";

import type { UsersSearch } from "#pages/users/model/users-search.ts";

type Members = typeof MemberList.Type;
type Member = Members["members"][number];

class PaidPlanRequired extends Error {
  override readonly name = "PaidPlanRequired";
}

const firstPage = 1;

async function loadMembers(search: UsersSearch, page: number): Promise<Members> {
  const { api } = await userClient();
  const query = {
    ...(search.keyword === undefined ? {} : { keyword: search.keyword }),
    page: String(page),
  };
  const reply = await api.members.get({ query });
  if (reply.error?.status === httpStatus.paymentRequired) {
    throw new PaidPlanRequired();
  }
  return apiData(MemberList, reply);
}

function membersKey(search: UsersSearch): readonly [string, string] {
  return ["members", search.keyword ?? ""];
}

function nextPage(loaded: Members, page: number): number | undefined {
  return page * loaded.pageSize < loaded.total ? page + 1 : undefined;
}

function membersOptions(search: UsersSearch) {
  return infiniteQueryOptions({
    getNextPageParam: (loaded: Members, pages: readonly Members[]) =>
      nextPage(loaded, firstPage + pages.length - 1),
    initialPageParam: firstPage,
    queryFn: async ({ pageParam }: Readonly<{ pageParam: number }>) =>
      loadMembers(search, pageParam),
    queryKey: membersKey(search),
  });
}

export { PaidPlanRequired, membersOptions };
export type { Member, Members };
