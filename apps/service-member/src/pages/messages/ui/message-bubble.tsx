import { CONVERSATION_KIND, REPORT_SUBJECT } from "@repo/config";

import { ReportControl } from "#shared/report-control.tsx";

import type { ConversationThread } from "#pages/messages/api/messages.ts";
import type { ConversationKind } from "@repo/config";
import type { ReactElement } from "react";

function MessageBubble({
  kind,
  message,
}: Readonly<{
  kind: ConversationKind;
  message: ConversationThread["messages"][number];
}>): ReactElement {
  const subjectKind =
    kind === CONVERSATION_KIND.group ? REPORT_SUBJECT.groupMessage : REPORT_SUBJECT.message;
  return (
    <li className={message.mine ? "flex justify-end" : "flex justify-start"}>
      <div
        className={`flex max-w-[80%] flex-col gap-1 rounded-lg border border-border px-3 py-2 ${message.mine ? "bg-secondary text-secondary-foreground" : "bg-card"}`}
      >
        <p className="text-sm leading-normal text-muted-foreground">{message.sender.name}</p>
        <p className="text-base leading-normal break-words whitespace-pre-wrap">{message.body}</p>
        {message.mine ? null : <ReportControl subjectId={message.id} subjectKind={subjectKind} />}
      </div>
    </li>
  );
}

export { MessageBubble };
