import { Button, Heading, Page, TextLink } from "@repo/ui";

import { reasonLabel, statusLabel } from "#pages/reports/model/report-labels.ts";

import type { ReportDetail } from "#shared/contracts/index.ts";
import type { ReactElement } from "react";

type ReportDecision = "dismiss" | "suspend" | "unsuspend" | "warn";

function MemberReference({
  memberId,
  name,
}: Readonly<{ memberId: string | null; name: string | null }>): ReactElement {
  if (memberId === null) {
    return <>退会した会員</>;
  }
  return (
    <TextLink params={{ id: memberId }} to="/members/$id">
      {name}
    </TextLink>
  );
}

function ReportView({
  blocked,
  error,
  onDecide,
  report,
}: Readonly<{
  blocked: boolean;
  error: string | undefined;
  onDecide: (decision: ReportDecision) => void;
  report: typeof ReportDetail.Type;
}>): ReactElement {
  const targetGone = report.targetMemberId === null;
  return (
    <Page title="通報">
      <Heading as="h1" size="page">
        通報
      </Heading>
      <TextLink to="/reports">一覧へ戻る</TextLink>
      <p>
        対象: <MemberReference memberId={report.targetMemberId} name={report.targetName} />
      </p>
      <p>
        理由: {reasonLabel[report.reason]} / 状態: {statusLabel[report.status]}
      </p>
      <p>
        通報者: <MemberReference memberId={report.reporterId} name={report.reporterName} />
      </p>
      <p className="break-words whitespace-pre-wrap">{report.body}</p>
      <div className="flex flex-wrap gap-3">
        <Button
          disabled={blocked || targetGone}
          onClick={() => {
            onDecide("suspend");
          }}
          type="button"
        >
          対象を停止する
        </Button>
        {report.targetSuspended && (
          <Button
            disabled={blocked || targetGone}
            onClick={() => {
              onDecide("unsuspend");
            }}
            type="button"
            variant="secondary"
          >
            停止を解除する
          </Button>
        )}
        <Button
          disabled={blocked}
          onClick={() => {
            onDecide("warn");
          }}
          type="button"
          variant="secondary"
        >
          注意する
        </Button>
        <Button
          disabled={blocked}
          onClick={() => {
            onDecide("dismiss");
          }}
          type="button"
          variant="secondary"
        >
          却下する
        </Button>
      </div>
      {error !== undefined && <p className="text-sm text-destructive">{error}</p>}
    </Page>
  );
}

export { ReportView };
export type { ReportDecision };
