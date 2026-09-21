import { apiData } from "@repo/runtime/client";

import { adminClient } from "#shared/api/index.ts";
import { ReportDetail, ReportList, ReportListQuery } from "#shared/contracts/index.ts";

import type { ReportStatus } from "@repo/config";

type ReportSummary = (typeof ReportList.Type)["reports"][number];
type ReportItem = typeof ReportDetail.Type;

async function loadReports(page: {
  readonly page: number;
  readonly status?: ReportStatus;
}): Promise<typeof ReportList.Type> {
  return apiData(
    ReportList,
    await adminClient().reports.get({
      query: {
        page: page.page,
        ...(page.status === undefined ? {} : { status: page.status }),
      } satisfies typeof ReportListQuery.Type,
    }),
  );
}

async function loadReport(id: string): Promise<ReportItem> {
  return apiData(ReportDetail, await adminClient().reports.detail.get({ query: { id } }));
}

export { loadReport, loadReports };
export type { ReportItem, ReportSummary };
