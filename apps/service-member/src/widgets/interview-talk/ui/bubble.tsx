import { InterviewSheet } from "./sheet.tsx";

import type { ReactElement } from "react";
import type { FieldViewData, InterviewViewData } from "../model/view.ts";

const bubbleClassName = "max-w-4/5 rounded-lg px-3 py-2 text-base leading-normal";
const sides = {
  interviewer: `${bubbleClassName} self-start border border-border bg-card text-card-foreground`,
  member: `${bubbleClassName} self-end bg-primary text-primary-foreground`,
} as const;

function InterviewBubble({
  card,
  speaker,
  text,
}: Readonly<{
  card?: readonly FieldViewData[] | undefined;
  speaker: InterviewViewData["messages"][number]["role"];
  text: string;
}>): ReactElement {
  return (
    <li className={sides[speaker]} data-speaker={speaker}>
      <p className="break-words whitespace-pre-wrap">{text}</p>
      {card !== undefined && <InterviewSheet fields={card} />}
    </li>
  );
}

export { InterviewBubble };
