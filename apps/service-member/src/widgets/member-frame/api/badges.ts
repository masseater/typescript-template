import { apiData } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";
import { NavBadges } from "#shared/contracts/index.ts";

import type { NavBadges as NavBadgesView } from "#shared/contracts/index.ts";

async function loadNavBadges(): Promise<NavBadgesView> {
  const { api } = await userClient();
  return apiData(NavBadges, await api.nav.badges.get());
}

export { loadNavBadges };
