import { Button } from "@repo/ui";

import type { ReactElement } from "react";

function InterviewOption({
  disabled,
  label,
  onChoose,
  pressed,
}: Readonly<{
  disabled: boolean;
  label: string;
  onChoose: (label: string) => void;
  pressed?: boolean;
}>): ReactElement {
  return (
    <Button
      aria-pressed={pressed}
      disabled={disabled}
      onClick={() => {
        onChoose(label);
      }}
      size="small"
      type="button"
      variant={pressed === true ? "primary" : "secondary"}
    >
      {label}
    </Button>
  );
}

export { InterviewOption };
