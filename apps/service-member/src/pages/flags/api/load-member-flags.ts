import { apiData } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";
import { MemberFlags } from "#shared/contracts/index.ts";

function loadMemberFlags(): Promise<boolean> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.flags.get().then((response) => apiData(MemberFlags, response).memberBoard),
  );
}

export { loadMemberFlags };
