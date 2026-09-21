import { Button, Field, useTextInput } from "@repo/ui";

import { maximumUtterance } from "#shared/interview/index.ts";

import type { MemberUtterance } from "#shared/interview/index.ts";
import type { ReactElement } from "react";

function InterviewComposer({
  disabled,
  say,
}: Readonly<{ disabled: boolean; say: (utterance: MemberUtterance) => void }>): ReactElement {
  const { handleChange, value } = useTextInput();
  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const text = value.trim();
        if (disabled || text === "") {
          return;
        }
        say({ kind: "text", text });
        handleChange("");
      }}
    >
      <Field
        autoComplete="off"
        label="メッセージ"
        maxLength={maximumUtterance}
        name="utterance"
        onValueChange={handleChange}
        value={value}
      />
      <Button disabled={disabled || value.trim() === ""} type="submit" variant="primary">
        送信
      </Button>
    </form>
  );
}

export { InterviewComposer };
