import { InterviewOption } from "./option.tsx";

import type { MemberUtterance } from "#shared/interview/index.ts";
import type { ReactElement } from "react";

function InterviewOneTap({
  disabled,
  options,
  say,
  utter,
}: Readonly<{
  disabled: boolean;
  options: readonly string[];
  say: (utterance: MemberUtterance) => void;
  utter: (label: string) => MemberUtterance;
}>): ReactElement {
  return (
    <>
      {options.map((option) => (
        <InterviewOption
          disabled={disabled}
          key={option}
          label={option}
          onChoose={(label) => {
            say(utter(label));
          }}
        />
      ))}
    </>
  );
}

export { InterviewOneTap };
