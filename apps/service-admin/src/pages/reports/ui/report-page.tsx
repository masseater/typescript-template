import { apiData } from "@repo/runtime/client";
import { Button, Heading, Page, TextLink, useAction } from "@repo/ui";
import { useRouter } from "@tanstack/react-router";

import { reasonLabel, statusLabel } from "#pages/reports/model/report-labels.ts";
import { adminClient } from "#shared/api/index.ts";
import { ReportActionResult } from "#shared/contracts/index.ts";

import type { ReportItem } from "#pages/reports/api/load-reports.ts";
import type { ReactElement } from "react";

function ReportPage({ report }: Readonly<{ report: ReportItem }>): ReactElement {
  const router = useRouter();
  const action = useAction();
  function run(task: () => Promise<unknown>): void {
    action.run(() => task().then(() => router.invalidate()));
  }
  return (
    <Page title="通報">
      <Heading as="h1" size="page">
        通報
      </Heading>
      <TextLink to="/reports">一覧へ戻る</TextLink>
      <p>
        対象:{" "}
        {report.targetMemberId === null ? (
          "退会した会員"
        ) : (
          <TextLink params={{ id: report.targetMemberId }} to="/members/$id">
            {report.targetName}
          </TextLink>
        )}
      </p>
      <p>
        理由: {reasonLabel[report.reason]} / 状態: {statusLabel[report.status]}
      </p>
      <p>
        通報者:{" "}
        {report.reporterId === null ? (
          "退会した会員"
        ) : (
          <TextLink params={{ id: report.reporterId }} to="/members/$id">
            {report.reporterName}
          </TextLink>
        )}
      </p>
      <p className="break-words whitespace-pre-wrap">{report.body}</p>
      <div className="flex flex-wrap gap-3">
        <Button
          disabled={action.blocked || report.targetMemberId === null}
          onClick={() => {
            run(() =>
              adminClient()
                .reports.suspend.post({ id: report.id })
                .then((response) => {
                  apiData(ReportActionResult, response);
                }),
            );
          }}
          type="button"
        >
          対象を停止する
        </Button>
        {report.targetSuspended && (
          <Button
            disabled={action.blocked || report.targetMemberId === null}
            onClick={() => {
              run(() =>
                adminClient()
                  .reports.unsuspend.post({ id: report.id })
                  .then((response) => {
                    apiData(ReportActionResult, response);
                  }),
              );
            }}
            type="button"
            variant="secondary"
          >
            停止を解除する
          </Button>
        )}
        <Button
          disabled={action.blocked}
          onClick={() => {
            run(() =>
              adminClient()
                .reports.warn.post({ id: report.id })
                .then((response) => {
                  apiData(ReportActionResult, response);
                }),
            );
          }}
          type="button"
          variant="secondary"
        >
          注意する
        </Button>
        <Button
          disabled={action.blocked}
          onClick={() => {
            run(() =>
              adminClient()
                .reports.dismiss.post({ id: report.id })
                .then((response) => {
                  apiData(ReportActionResult, response);
                }),
            );
          }}
          type="button"
          variant="secondary"
        >
          却下する
        </Button>
      </div>
      {action.error !== undefined && <p className="text-sm text-destructive">{action.error}</p>}
    </Page>
  );
}

export { ReportPage };
