import { Button, localState } from "@repo/ui";

import { maximumInterests } from "#shared/interview/index.ts";
import { InterviewOption } from "./option.tsx";

import type { MemberUtterance } from "#shared/interview/index.ts";
import type { ReactElement } from "react";

const useChosen = localState<readonly string[]>([]);

function InterviewMultipleChoice({
  disabled,
  options,
  say,
}: Readonly<{
  disabled: boolean;
  options: readonly string[];
  say: (utterance: MemberUtterance) => void;
}>): ReactElement {
  const [chosen, setChosen] = useChosen();
  const toggle = (label: string): void => {
    if (chosen.includes(label)) {
      setChosen(chosen.filter((value) => value !== label));
      return;
    }
    if (chosen.length >= maximumInterests) {
      return;
    }
    setChosen([...chosen, label]);
  };
  return (
    <>
      {options.map((option) => (
        <InterviewOption
          disabled={disabled || (chosen.length >= maximumInterests && !chosen.includes(option))}
          key={option}
          label={option}
          onChoose={toggle}
          pressed={chosen.includes(option)}
        />
      ))}
      <Button
        disabled={disabled || chosen.length === 0}
        onClick={() => {
          say({ kind: "choice", values: options.filter((option) => chosen.includes(option)) });
        }}
        size="small"
        type="button"
        variant="primary"
      >
        これで送る
      </Button>
    </>
  );
}

export { InterviewMultipleChoice };
