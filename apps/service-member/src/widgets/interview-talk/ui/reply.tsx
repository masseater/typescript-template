import { Button } from "@repo/ui";

import { InterviewMultipleChoice } from "./multiple-choice.tsx";
import { InterviewOneTap } from "./one-tap.tsx";

import type { MemberUtterance } from "#shared/interview/index.ts";
import type { ReactElement } from "react";
import type { InterviewViewData } from "../model/view.ts";

const confirmations = ["はい", "いいえ"] as const;

function asChoice(label: string): MemberUtterance {
  return { kind: "choice", values: [label] };
}

function asText(label: string): MemberUtterance {
  return { kind: "text", text: label };
}

function InterviewReply({
  disabled,
  reply,
  say,
}: Readonly<{
  disabled: boolean;
  reply: InterviewViewData["reply"];
  say: (utterance: MemberUtterance) => void;
}>): ReactElement {
  return (
    <fieldset aria-label="回答欄" className="flex flex-wrap items-center gap-2">
      {reply?.kind === "single" && (
        <InterviewOneTap disabled={disabled} options={reply.options} say={say} utter={asChoice} />
      )}
      {reply?.kind === "multiple" && (
        <InterviewMultipleChoice disabled={disabled} options={reply.options} say={say} />
      )}
      {reply?.kind === "confirm" && (
        <InterviewOneTap disabled={disabled} options={confirmations} say={say} utter={asText} />
      )}
      <Button
        disabled={disabled}
        onClick={() => {
          say({ kind: "skip" });
        }}
        size="small"
        type="button"
      >
        この質問はスキップ
      </Button>
    </fieldset>
  );
}

export { InterviewReply };
