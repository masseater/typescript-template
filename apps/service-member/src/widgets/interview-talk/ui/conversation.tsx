import { Button, STATUS_VARIANT, StatusMessage } from "@repo/ui";

import { spoken } from "#shared/interview/index.ts";
import { InterviewActions } from "./actions.tsx";
import { InterviewHeader } from "./header.tsx";
import { InterviewMessages } from "./messages.tsx";

import type { ReactElement } from "react";
import type { Interview } from "../model/interview.ts";
import type { InterviewViewData } from "../model/view.ts";

function InterviewConversation({
  interview,
  suspended,
  view,
}: Readonly<{
  interview: Interview;
  suspended: boolean;
  view: InterviewViewData;
}>): ReactElement {
  const { restart, save, turn } = interview;
  const busy = suspended || turn.isPending || save.isPending || restart.isPending;
  const failure = turn.error ?? save.error ?? restart.error;
  const unheard = turn.isPending || turn.isError ? turn.variables : undefined;
  return (
    <section aria-label="インタビュー" className="flex min-w-0 flex-1 flex-col gap-3">
      <InterviewHeader
        disabled={busy}
        onFinish={() => {
          turn.mutate({ kind: "finish" });
        }}
        view={view}
      />
      <InterviewMessages
        heard={unheard === undefined ? undefined : spoken(unheard)}
        messages={view.messages}
        typing={turn.isPending}
      />
      {failure !== null && (
        <StatusMessage variant={STATUS_VARIANT.failure}>{failure.message}</StatusMessage>
      )}
      {turn.isError && unheard !== undefined && (
        <Button
          onClick={() => {
            turn.mutate(unheard);
          }}
          size="small"
          type="button"
        >
          再試行
        </Button>
      )}
      <InterviewActions disabled={busy} interview={interview} view={view} />
    </section>
  );
}

export { InterviewConversation };
