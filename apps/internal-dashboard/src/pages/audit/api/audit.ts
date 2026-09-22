import { apiData } from "@repo/runtime/client";

import { wikiClient } from "#shared/api/index.ts";
import { StaffAuditPage, type StaffAuditPageView } from "#shared/contracts/index.ts";

import type { AuditPageQuery } from "#shared/contracts/index.ts";

function loadAuditPage(query: typeof AuditPageQuery.Type): Promise<StaffAuditPageView> {
  return Promise.resolve(wikiClient()).then(({ api }) =>
    api.audit.get({ query }).then((response) => apiData(StaffAuditPage, response)),
  );
}

export { loadAuditPage };
