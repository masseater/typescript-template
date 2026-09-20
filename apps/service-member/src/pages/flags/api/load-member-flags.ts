import { apiData } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";
import { MemberFlags } from "#shared/contracts/index.ts";

async function loadMemberFlags(): Promise<boolean> {
  const { api } = await userClient();
  const { memberBoard } = apiData(MemberFlags, await api.flags.get());
  return memberBoard;
}

export { loadMemberFlags };
