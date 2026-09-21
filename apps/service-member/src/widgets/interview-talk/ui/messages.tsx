import { InterviewBubble } from "./bubble.tsx";

import type { ReactElement } from "react";
import type { InterviewViewData } from "../model/view.ts";

function InterviewMessages({
  heard,
  messages,
  typing,
}: Readonly<{
  heard: string | undefined;
  messages: InterviewViewData["messages"];
  typing: boolean;
}>): ReactElement {
  const bubbles = messages.length + Number(heard !== undefined) + Number(typing);
  return (
    <ol
      aria-label="会話"
      className="flex max-h-120 flex-col gap-2 overflow-y-auto rounded-lg bg-muted p-3"
    >
      {messages.map((message, index) => (
        <InterviewBubble
          card={message.card}
          key={`${message.role}:${index}:${message.text}`}
          speaker={message.role}
          text={message.text}
        />
      ))}
      {heard !== undefined && <InterviewBubble speaker="member" text={heard} />}
      {typing && <InterviewBubble speaker="interviewer" text="入力中…" />}
      <li
        aria-hidden="true"
        key={bubbles}
        ref={(node) => {
          node?.scrollIntoView({ block: "nearest" });
        }}
      />
    </ol>
  );
}

export { InterviewMessages };
