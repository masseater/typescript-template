import { apiData } from "@repo/runtime/client";

import { wikiClient } from "#shared/api/index.ts";
import { StaffAuditPage, type StaffAuditPageView } from "#shared/contracts/index.ts";

import type { AuditPageQuery } from "#shared/contracts/index.ts";

async function loadAuditPage(query: typeof AuditPageQuery.Type): Promise<StaffAuditPageView> {
  const { api } = await wikiClient();
  return apiData(StaffAuditPage, await api.audit.get({ query }));
}

export { loadAuditPage };
