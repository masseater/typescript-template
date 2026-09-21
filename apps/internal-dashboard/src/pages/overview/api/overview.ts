import { apiData } from "@repo/runtime/client";

import { wikiClient } from "#shared/api/index.ts";
import { StaffOverview } from "#shared/contracts/index.ts";

async function loadOverview(): Promise<typeof StaffOverview.Type> {
  const api = await wikiClient();
  return apiData(StaffOverview, await api.overview.get());
}

export { loadOverview };
