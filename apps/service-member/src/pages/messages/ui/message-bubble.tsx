import { REPORT_SUBJECT } from "@repo/config";

import { ReportControl } from "#shared/ui/index.ts";

import type { ConversationThread } from "#pages/messages/api/messages.ts";
import type { ReportSubject } from "@repo/config";
import type { ReactElement } from "react";

type Message = ConversationThread["messages"][number];

type ConversationKind = "direct" | "group";

const ownBubble = { alignment: "justify-end", tone: "bg-primary text-primary-foreground" };

const peerBubble = {
  alignment: "justify-start",
  tone: "border border-border bg-card text-card-foreground",
};

function reportSubject(kind: ConversationKind): ReportSubject {
  return kind === "group" ? REPORT_SUBJECT.groupMessage : REPORT_SUBJECT.directMessage;
}

function SenderName({ message }: Readonly<{ message: Message }>): ReactElement | undefined {
  if (message.mine) {
    return undefined;
  }
  return <p className="mb-1 text-xs leading-tight font-bold opacity-80">{message.sender.name}</p>;
}

function MessageReport({
  kind,
  message,
}: Readonly<{ kind: ConversationKind; message: Message }>): ReactElement | undefined {
  if (message.mine) {
    return undefined;
  }
  return (
    <div className="mt-2">
      <ReportControl subjectId={message.id} subjectKind={reportSubject(kind)} />
    </div>
  );
}

function MessageBubble({
  kind,
  message,
}: Readonly<{
  kind: ConversationKind;
  message: Message;
}>): ReactElement {
  const bubble = message.mine ? ownBubble : peerBubble;
  return (
    <li className={`flex ${bubble.alignment}`}>
      <div className={`rounded-2xl max-w-[85%] px-4 py-2 text-base leading-relaxed ${bubble.tone}`}>
        <SenderName message={message} />
        <p className="whitespace-pre-wrap">{message.body}</p>
        <MessageReport kind={kind} message={message} />
      </div>
    </li>
  );
}

export { MessageBubble };
