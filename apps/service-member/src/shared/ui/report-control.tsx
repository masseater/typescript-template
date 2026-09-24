import { REPORT_REASON, reportReasons } from "@repo/config";
import { Button, SelectField, localState, useAction } from "@repo/ui";

import { fileReport } from "#shared/api/index.ts";

import type { ReportReason, ReportSubject } from "@repo/config";
import type { FormEvent, ReactElement } from "react";
const reasonOptions = [
  {
    label: "迷惑行為",
    value: REPORT_REASON.harassment,
  },
  {
    label: "スパム",
    value: REPORT_REASON.spam,
  },
  {
    label: "その他",
    value: REPORT_REASON.other,
  },
] as const;
const useOpenId = localState<string | undefined>(undefined);
const useReason = localState<string>(REPORT_REASON.harassment);
function isReason(value: string): value is ReportReason {
  return reportReasons.some((reason) => reason === value);
}
function ReportControl({
  subjectId,
  subjectKind,
}: Readonly<{
  subjectId: string;
  subjectKind: ReportSubject;
}>): ReactElement {
  const action = useAction();
  const [openId, setOpenId] = useOpenId();
  const [reason, setReason] = useReason();
  if (openId !== subjectId) {
    return (
      <Button
        onClick={() => {
          setOpenId(subjectId);
        }}
        type="button"
        variant="secondary"
      >
        通報
      </Button>
    );
  }
  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!isReason(reason)) {
      return;
    }
    action.run(() => fileReport(subjectKind, subjectId, reason).then(() => setOpenId(undefined)));
  }
  return (
    <form className="flex flex-col gap-2" onSubmit={submit}>
      <SelectField
        label="理由"
        name="reason"
        onValueChange={setReason}
        options={reasonOptions}
        value={reason}
      />
      <Button disabled={action.blocked} type="submit" variant="secondary">
        通報する
      </Button>
      {action.error !== undefined && <p className="text-sm text-destructive">{action.error}</p>}
    </form>
  );
}
export { ReportControl };
