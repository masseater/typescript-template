import { apiData } from "@repo/runtime/client";
import { useAction } from "@repo/ui";
import { useRouter } from "@tanstack/react-router";

import { adminClient } from "#shared/api/index.ts";
import { ReportActionResult } from "#shared/contracts/index.ts";
import { ReportView, type ReportDecision } from "./report-view.tsx";

import type { ReportItem } from "#pages/reports/api/load-reports.ts";
import type { ReactElement } from "react";

function ReportPage({ report }: Readonly<{ report: ReportItem }>): ReactElement {
  const router = useRouter();
  const action = useAction();
  function decide(decision: ReportDecision): void {
    action.run(() =>
      adminClient()
        .reports[decision].post({ id: report.id })
        .then((response) => {
          apiData(ReportActionResult, response);
        })
        .then(() => router.invalidate()),
    );
  }
  return (
    <ReportView blocked={action.blocked} error={action.error} onDecide={decide} report={report} />
  );
}

export { ReportPage };
