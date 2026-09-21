import { REPORT_REASON, REPORT_STATUS } from "@repo/config";
import { Heading, STATUS_VARIANT, StatusMessage, TextLink, formatWarekiDateTime } from "@repo/ui";

import { OpsPage } from "#widgets/ops-page/index.ts";

import type { ReportListView } from "#pages/reports/api/load-reports.ts";
import type { ReportSearch } from "#pages/reports/model/report-search.ts";
import type { ReactElement } from "react";

const reasonLabel = {
  [REPORT_REASON.harassment]: "迷惑行為",
  [REPORT_REASON.other]: "その他",
  [REPORT_REASON.spam]: "スパム",
} as const;

const statusLabel = {
  [REPORT_STATUS.actioned]: "処置済み",
  [REPORT_STATUS.dismissed]: "却下",
  [REPORT_STATUS.open]: "未対応",
} as const;

function ReportsPage({
  listing,
  search,
}: Readonly<{ listing: ReportListView; search: ReportSearch }>): ReactElement {
  const last = Math.max(1, Math.ceil(listing.total / listing.pageSize));
  return (
    <OpsPage title="通報">
      <Heading as="h1" size="page">
        通報
      </Heading>
      <nav aria-label="状態" className="flex gap-3 text-sm">
        <TextLink search={{}} to="/reports">
          すべて
        </TextLink>
        <TextLink search={{ status: REPORT_STATUS.open }} to="/reports">
          未対応
        </TextLink>
        <TextLink search={{ status: REPORT_STATUS.actioned }} to="/reports">
          処置済み
        </TextLink>
        <TextLink search={{ status: REPORT_STATUS.dismissed }} to="/reports">
          却下
        </TextLink>
      </nav>
      <p className="text-sm text-muted-foreground">{listing.total} 件</p>
      {listing.reports.length === 0 ? (
        <StatusMessage variant={STATUS_VARIANT.pending}>
          条件に一致する通報はありません
        </StatusMessage>
      ) : (
        <table className="w-full text-left text-sm">
          <caption className="sr-only">通報</caption>
          <thead>
            <tr>
              <th>対象</th>
              <th>理由</th>
              <th>状態</th>
              <th>通報者</th>
              <th>受付日</th>
            </tr>
          </thead>
          <tbody>
            {listing.reports.map((report) => (
              <tr key={report.id}>
                <td>
                  <TextLink params={{ id: report.id }} to="/reports/$id">
                    {report.targetName ?? "退会した会員"}
                  </TextLink>
                </td>
                <td>{reasonLabel[report.reason]}</td>
                <td>{statusLabel[report.status]}</td>
                <td>{report.reporterName ?? "退会した会員"}</td>
                <td>{formatWarekiDateTime(report.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="flex gap-3">
        {search.page > 1 && (
          <TextLink search={{ ...search, page: search.page - 1 }} to="/reports">
            前へ
          </TextLink>
        )}
        {search.page < last && (
          <TextLink search={{ ...search, page: search.page + 1 }} to="/reports">
            次へ
          </TextLink>
        )}
      </div>
    </OpsPage>
  );
}

export { ReportsPage };
