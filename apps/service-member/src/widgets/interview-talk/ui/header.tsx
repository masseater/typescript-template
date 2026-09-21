import { Button } from "@repo/ui";

import { InterviewProgress } from "./progress.tsx";

import type { ReactElement } from "react";
import type { InterviewViewData } from "../model/view.ts";

function InterviewHeader({
  disabled,
  onFinish,
  view,
}: Readonly<{
  disabled: boolean;
  onFinish: () => void;
  view: InterviewViewData;
}>): ReactElement {
  return (
    <header className="flex flex-wrap items-start justify-between gap-2 border-b border-border pb-2">
      <hgroup className="flex flex-col">
        <h2 className="text-base font-bold text-foreground">インタビュアー</h2>
        <InterviewProgress fields={view.fields} />
      </hgroup>
      {view.phase === "asking" && (
        <Button disabled={disabled} onClick={onFinish} size="small" type="button">
          ここで終える
        </Button>
      )}
    </header>
  );
}

export { InterviewHeader };
