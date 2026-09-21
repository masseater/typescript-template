import { Button } from "@repo/ui";

import { InterviewComposer } from "./composer.tsx";
import { InterviewReply } from "./reply.tsx";
import { InterviewRestart } from "./restart.tsx";

import type { ReactElement } from "react";
import type { Interview } from "../model/interview.ts";
import type { InterviewViewData } from "../model/view.ts";

function InterviewActions({
  disabled,
  interview,
  view,
}: Readonly<{
  disabled: boolean;
  interview: Interview;
  view: InterviewViewData;
}>): ReactElement {
  const { restart, save, turn } = interview;
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3">
      {view.phase === "asking" && (
        <InterviewReply
          disabled={disabled}
          key={view.messages.length}
          reply={view.reply}
          say={turn.mutate}
        />
      )}
      {view.phase === "summary" && (
        <Button
          disabled={disabled}
          onClick={() => {
            save.mutate();
          }}
          type="button"
          variant="primary"
        >
          この内容で保存
        </Button>
      )}
      {view.phase === "saved" && (
        <InterviewRestart
          disabled={disabled}
          onRestart={() => {
            restart.mutate();
          }}
        />
      )}
      <InterviewComposer disabled={disabled} say={turn.mutate} />
    </div>
  );
}

export { InterviewActions };
