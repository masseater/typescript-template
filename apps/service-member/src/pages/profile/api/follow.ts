import { apiData } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";
import { FollowMember } from "#shared/contracts/index.ts";

async function followMember(memberId: string): Promise<void> {
  const { api } = await userClient();
  apiData(FollowMember, await api.social.follow.put({ memberId }));
}

async function unfollowMember(memberId: string): Promise<void> {
  const { api } = await userClient();
  apiData(FollowMember, await api.social.follow.delete({ memberId }));
}

export { followMember, unfollowMember };
