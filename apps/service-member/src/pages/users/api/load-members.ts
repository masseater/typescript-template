import { httpStatus } from "@repo/observability/http-status";
import { apiData } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";
import { MemberList } from "#shared/contracts/index.ts";

import type { UsersSearch } from "#pages/users/model/users-search.ts";

type Members = typeof MemberList.Type;

class PaidPlanRequired extends Error {
  override readonly name = "PaidPlanRequired";
}

async function loadMembers(search: UsersSearch): Promise<Members> {
  const { api } = await userClient();
  const query = {
    ...(search.keyword === undefined ? {} : { keyword: search.keyword }),
    page: String(search.page ?? 1),
  };
  const reply = await api.members.get({ query });
  if (reply.error?.status === httpStatus.paymentRequired) {
    throw new PaidPlanRequired();
  }
  return apiData(MemberList, reply);
}

export { PaidPlanRequired, loadMembers };
export type { Members };
