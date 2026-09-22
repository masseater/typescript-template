import { apiData } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";
import { FollowMember } from "#shared/contracts/index.ts";

function followMember(memberId: string): Promise<void> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.social.follow.put({ memberId }).then((response) => {
      apiData(FollowMember, response);
    }),
  );
}

function unfollowMember(memberId: string): Promise<void> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.social.follow.delete({ memberId }).then((response) => {
      apiData(FollowMember, response);
    }),
  );
}

export { followMember, unfollowMember };
