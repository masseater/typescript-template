import { REPORT_REASON, REPORT_STATUS } from "@repo/config";
import { NavigationLink, STATUS_VARIANT, StatusMessage } from "@repo/ui";

import { OpsPage } from "#widgets/ops-page/index.ts";

import type { ReportSummary } from "#pages/reports/api/load-reports.ts";
import type { ReportStatus } from "@repo/config";
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

const statusFilters = [
  REPORT_STATUS.open,
  REPORT_STATUS.actioned,
  REPORT_STATUS.dismissed,
] as const;

function ReportsPage({
  reports,
  status,
}: Readonly<{
  reports: readonly ReportSummary[];
  status: ReportStatus | undefined;
}>): ReactElement {
  return (
    <OpsPage title="通報">
      <div className="flex flex-wrap gap-2">
        <NavigationLink search={{}} to="/reports">
          すべて
        </NavigationLink>
        {statusFilters.map((filter) => (
          <NavigationLink key={filter} search={{ status: filter }} to="/reports">
            {statusLabel[filter]}
          </NavigationLink>
        ))}
      </div>
      {reports.length === 0 ? (
        <StatusMessage variant={STATUS_VARIANT.empty}>
          {status === undefined ? "通報はまだありません。" : "この状態の通報はありません。"}
        </StatusMessage>
      ) : (
        <ul className="flex flex-col gap-3">
          {reports.map((report) => (
            <li key={report.id}>
              <NavigationLink params={{ id: report.id }} to="/reports/$id">
                {reasonLabel[report.reason]} / {statusLabel[report.status]} /{" "}
                {report.targetName ?? "退会した会員"}
              </NavigationLink>
            </li>
          ))}
        </ul>
      )}
    </OpsPage>
  );
}

export { ReportsPage };
