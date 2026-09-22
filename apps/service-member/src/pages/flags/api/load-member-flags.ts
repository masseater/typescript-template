import { apiData } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";
import { MemberFlags } from "#shared/contracts/index.ts";

import type { ApiReply } from "@repo/runtime/client";

function loadMemberFlags(): Promise<boolean> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.flags.get().then((response: ApiReply) => apiData(MemberFlags, response).memberBoard),
  );
}

export { loadMemberFlags };
