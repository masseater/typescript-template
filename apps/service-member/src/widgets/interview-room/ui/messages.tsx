import { InterviewBubble } from "./bubble.tsx";

import type { InterviewViewData } from "#shared/interview/index.ts";
import type { ReactElement } from "react";

function messageKey(
  seen: Map<string, number>,
  message: InterviewViewData["messages"][number],
): string {
  const base = `${message.role}:${message.text}`;
  const count = (seen.get(base) ?? 0) + 1;
  seen.set(base, count);
  return `${base}:${count}`;
}

function InterviewMessages({
  heard,
  messages,
  typing,
}: Readonly<{
  heard: string | undefined;
  messages: InterviewViewData["messages"];
  typing: boolean;
}>): ReactElement {
  const seen = new Map<string, number>();
  return (
    <ol
      aria-label="会話"
      className="flex max-h-80 flex-col gap-2 overflow-y-auto rounded-lg bg-muted p-3"
    >
      {messages.map((message) => (
        <InterviewBubble
          card={message.card}
          key={messageKey(seen, message)}
          speaker={message.role}
          text={message.text}
        />
      ))}
      {heard !== undefined && <InterviewBubble speaker="member" text={heard} />}
      {typing && <InterviewBubble speaker="interviewer" text="入力中" />}
    </ol>
  );
}

export { InterviewMessages };
