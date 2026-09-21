import { Button, STATUS_VARIANT, StatusMessage } from "@repo/ui";

import { InterviewActions } from "./actions.tsx";
import { InterviewHeader } from "./header.tsx";
import { InterviewMessages } from "./messages.tsx";
import { InterviewSheet } from "./sheet.tsx";

import type { ReactElement } from "react";
import type { InterviewViewData, MemberUtterance } from "../api/interview.ts";

function InterviewFailure({
  failure,
  onRetry,
  turnFailed,
}: Readonly<{
  failure: string | undefined;
  onRetry: () => void;
  turnFailed: boolean;
}>): ReactElement | null {
  if (failure === undefined) {
    return null;
  }
  return (
    <div className="flex flex-col items-start gap-2">
      <StatusMessage variant={STATUS_VARIANT.failure}>{failure}</StatusMessage>
      {turnFailed && (
        <Button onClick={onRetry} size="small" type="button" variant="secondary">
          再試行
        </Button>
      )}
    </div>
  );
}

function InterviewScreen({
  busy,
  failure,
  heard,
  onFinish,
  onRestart,
  onRetry,
  onSave,
  onSay,
  turnFailed,
  typing,
  view,
}: Readonly<{
  busy: boolean;
  failure: string | undefined;
  heard: string | undefined;
  onFinish: () => void;
  onRestart: () => void;
  onRetry: () => void;
  onSave: () => void;
  onSay: (utterance: MemberUtterance) => void;
  turnFailed: boolean;
  typing: boolean;
  view: InterviewViewData;
}>): ReactElement {
  return (
    <div className="flex items-start gap-4">
      <section aria-label="インタビュー" className="flex min-w-0 flex-1 flex-col gap-3">
        <InterviewHeader busy={busy} onFinish={onFinish} view={view} />
        <InterviewMessages heard={heard} messages={view.messages} typing={typing} />
        <InterviewFailure failure={failure} onRetry={onRetry} turnFailed={turnFailed} />
        <InterviewActions
          busy={busy}
          onRestart={onRestart}
          onSave={onSave}
          onSay={onSay}
          view={view}
        />
      </section>
      <aside
        aria-label="整形中の自己紹介シート"
        className="sticky top-4 hidden w-64 shrink-0 md:block"
      >
        <InterviewSheet fields={view.fields} />
      </aside>
    </div>
  );
}

export { InterviewScreen };
