import { reportStatuses } from "@repo/config";

import type { ReportStatus } from "@repo/config";

interface ReportSearch {
  readonly page: number;
  readonly status?: ReportStatus;
}

class InvalidReportSearch extends Error {
  override readonly name = "InvalidReportSearch";
}

function isStatus(value: string): value is ReportStatus {
  return reportStatuses.some((status) => status === value);
}

function normalizeReportSearch(raw: unknown): ReportSearch {
  const source = raw !== null && typeof raw === "object" ? raw : {};
  const record = source as Record<string, unknown>;
  const page = record.page === undefined ? 1 : Number(record.page);
  const status =
    typeof record.status === "string" && isStatus(record.status) ? record.status : undefined;
  if (!Number.isInteger(page) || page < 1 || page > 1_000_000) {
    throw new InvalidReportSearch();
  }
  if (record.status !== undefined && status === undefined) {
    throw new InvalidReportSearch();
  }
  return status === undefined ? { page } : { page, status };
}

export { InvalidReportSearch, normalizeReportSearch };
export type { ReportSearch };
