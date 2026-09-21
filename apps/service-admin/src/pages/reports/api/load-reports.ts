import { apiData, apiDataOrNone, absent } from "@repo/runtime/client";
import { notFound } from "@tanstack/react-router";

import { adminClient } from "#shared/api/index.ts";
import { ReportDetail, ReportList } from "#shared/contracts/index.ts";

import type { ReportSearch } from "#pages/reports/model/report-search.ts";

type ReportListView = typeof ReportList.Type;
type ReportItem = typeof ReportDetail.Type;

async function loadReports(search: ReportSearch): Promise<ReportListView> {
  const query = {
    page: String(search.page),
    ...(search.status === undefined ? {} : { status: search.status }),
  };
  return apiData(ReportList, await adminClient().reports.get({ query }));
}

async function loadReport(id: string): Promise<ReportItem> {
  const report = apiDataOrNone(
    ReportDetail,
    await adminClient().reports.item.get({ query: { id } }),
    absent.notFound,
  );
  if (report === undefined) {
    throw notFound();
  }
  return report;
}

export { loadReport, loadReports };
export type { ReportItem, ReportListView };
