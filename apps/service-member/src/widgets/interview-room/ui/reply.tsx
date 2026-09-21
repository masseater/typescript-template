import { useAtom } from "@effect/atom-react";
import { Button, CheckboxField } from "@repo/ui";
import { Atom } from "effect/unstable/reactivity";

import { maximumInterests } from "#shared/interview/index.ts";

import type { ReactElement } from "react";
import type { InterviewViewData, MemberUtterance } from "../api/interview.ts";

const chosenAtom = Atom.family((questionKey: string) => {
  void questionKey;
  return Atom.make<readonly string[]>([]);
});

function nextChosen(
  current: readonly string[],
  label: string,
  checked: boolean,
): readonly string[] {
  if (!checked) {
    return current.filter((value) => value !== label);
  }
  if (current.includes(label) || current.length >= maximumInterests) {
    return current;
  }
  return [...current, label];
}

function InterviewOption({
  disabled,
  label,
  onChoose,
}: Readonly<{
  disabled: boolean;
  label: string;
  onChoose: (label: string) => void;
}>): ReactElement {
  const handleClick = (): void => {
    onChoose(label);
  };
  return (
    <Button
      disabled={disabled}
      onClick={handleClick}
      size="small"
      type="button"
      variant="secondary"
    >
      {label}
    </Button>
  );
}

function InterviewChoices({
  disabled,
  onChoose,
  options,
}: Readonly<{
  disabled: boolean;
  onChoose: (label: string) => void;
  options: readonly string[];
}>): ReactElement {
  return (
    <>
      {options.map((option) => (
        <InterviewOption disabled={disabled} key={option} label={option} onChoose={onChoose} />
      ))}
    </>
  );
}

function InterviewInterest({
  checked,
  disabled,
  label,
  onToggle,
}: Readonly<{
  checked: boolean;
  disabled: boolean;
  label: string;
  onToggle: (label: string, checked: boolean) => void;
}>): ReactElement {
  const handleChecked = (next: boolean): void => {
    if (!disabled) {
      onToggle(label, next);
    }
  };
  return <CheckboxField checked={checked} label={label} onCheckedChange={handleChecked} />;
}

function InterviewMultipleChoice({
  disabled,
  onSay,
  options,
  questionKey,
}: Readonly<{
  disabled: boolean;
  onSay: (utterance: MemberUtterance) => void;
  options: readonly string[];
  questionKey: string;
}>): ReactElement {
  const [chosen, setChosen] = useAtom(chosenAtom(questionKey));
  const handleToggle = (label: string, checked: boolean): void => {
    setChosen((current) => nextChosen(current, label, checked));
  };
  const handleSend = (): void => {
    onSay({ kind: "choice", values: options.filter((option) => chosen.includes(option)) });
  };
  return (
    <>
      {options.map((option) => (
        <InterviewInterest
          checked={chosen.includes(option)}
          disabled={disabled}
          key={option}
          label={option}
          onToggle={handleToggle}
        />
      ))}
      <Button
        disabled={disabled || chosen.length === 0}
        onClick={handleSend}
        size="small"
        type="button"
        variant="primary"
      >
        これで送る
      </Button>
    </>
  );
}

function InterviewReply({
  disabled,
  onSay,
  questionKey,
  reply,
}: Readonly<{
  disabled: boolean;
  onSay: (utterance: MemberUtterance) => void;
  questionKey: string;
  reply: InterviewViewData["reply"];
}>): ReactElement {
  const handleSkip = (): void => {
    onSay({ kind: "skip" });
  };
  const handleChoice = (label: string): void => {
    onSay({ kind: "choice", values: [label] });
  };
  const handleConfirm = (label: string): void => {
    onSay({ kind: "text", text: label });
  };
  return (
    <div aria-label="回答欄" className="flex flex-wrap items-center gap-2" role="group">
      {reply?.kind === "single" && (
        <InterviewChoices disabled={disabled} onChoose={handleChoice} options={reply.options} />
      )}
      {reply?.kind === "multiple" && (
        <InterviewMultipleChoice
          disabled={disabled}
          onSay={onSay}
          options={reply.options}
          questionKey={questionKey}
        />
      )}
      {reply?.kind === "confirm" && (
        <InterviewChoices
          disabled={disabled}
          onChoose={handleConfirm}
          options={["はい", "いいえ"]}
        />
      )}
      <Button
        disabled={disabled}
        onClick={handleSkip}
        size="small"
        type="button"
        variant="secondary"
      >
        この質問はスキップ
      </Button>
    </div>
  );
}

export { InterviewReply };
