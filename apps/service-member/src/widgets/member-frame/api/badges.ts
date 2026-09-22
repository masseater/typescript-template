import { apiData } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";
import { NavBadges } from "#shared/contracts/index.ts";

import type { ApiReply } from "@repo/runtime/client";

type NavBadgesData = typeof NavBadges.Type;

function loadNavBadges(): Promise<NavBadgesData> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.nav.badges.get().then((response: ApiReply) => apiData(NavBadges, response)),
  );
}

export { loadNavBadges };
export type { NavBadgesData };
