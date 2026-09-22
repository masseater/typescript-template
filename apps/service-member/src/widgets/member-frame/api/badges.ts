import { apiData } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";
import { NavBadges } from "#shared/contracts/index.ts";

import type { NavBadges as NavBadgesView } from "#shared/contracts/index.ts";

function loadNavBadges(): Promise<NavBadgesView> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.nav.badges.get().then((response) => apiData(NavBadges, response)),
  );
}

export { loadNavBadges };
