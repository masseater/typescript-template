import { Button, STATUS_VARIANT, StatusMessage } from "@repo/ui";

import { useInterview } from "../model/interview.ts";
import { InterviewConversation } from "./conversation.tsx";
import { InterviewSheet } from "./sheet.tsx";

import type { ReactElement } from "react";

function InterviewRoom({
  onSheetSaved,
  suspended,
}: Readonly<{ onSheetSaved: (() => void) | undefined; suspended: boolean }>): ReactElement {
  const interview = useInterview(onSheetSaved);
  const { conversation } = interview;
  if (conversation.data !== undefined) {
    return (
      <div className="flex items-start gap-4">
        <InterviewConversation
          interview={interview}
          suspended={suspended}
          view={conversation.data}
        />
        <aside
          aria-label="整形中の自己紹介シート"
          className="sticky top-4 hidden w-64 shrink-0 md:block"
        >
          <InterviewSheet fields={conversation.data.fields} />
        </aside>
      </div>
    );
  }
  if (conversation.isError) {
    return (
      <>
        <StatusMessage variant={STATUS_VARIANT.failure}>{conversation.error.message}</StatusMessage>
        <Button
          onClick={() => {
            void conversation.refetch();
          }}
          type="button"
        >
          再試行
        </Button>
      </>
    );
  }
  return <StatusMessage variant={STATUS_VARIANT.pending}>会話を読み込み中です。</StatusMessage>;
}

export { InterviewRoom };
