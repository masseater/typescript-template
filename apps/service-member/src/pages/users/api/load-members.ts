import { httpStatus } from "@repo/config";
import { apiData } from "@repo/runtime/client";
import { Schema } from "effect";

import { userClient } from "#shared/api/index.ts";
import { MemberList } from "#shared/contracts/index.ts";

import type { UsersSearch } from "#pages/users/model/users-search.ts";

type Members = typeof MemberList.Type;

class PaidPlanRequired extends Schema.TaggedError<PaidPlanRequired>()("PaidPlanRequired", {}) {}

function loadMembers(search: UsersSearch): Promise<Members> {
  const query = {
    ...(search.keyword === undefined ? {} : { keyword: search.keyword }),
    page: String(search.page ?? 1),
  };
  return Promise.resolve(userClient()).then(({ api }) =>
    api.members.get({ query }).then((reply) => {
      if (reply.error?.status === httpStatus.paymentRequired) {
        throw new PaidPlanRequired();
      }
      return apiData(MemberList, reply);
    }),
  );
}

export { PaidPlanRequired, loadMembers };
export type { Members };
