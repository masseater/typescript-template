import { Button, Heading } from "@repo/ui";

import { InterviewProgress } from "./progress.tsx";

import type { ReactElement } from "react";
import type { InterviewViewData } from "../api/interview.ts";

function InterviewHeader({
  busy,
  onFinish,
  view,
}: Readonly<{
  busy: boolean;
  onFinish: () => void;
  view: InterviewViewData;
}>): ReactElement {
  return (
    <header className="flex items-start justify-between gap-2 border-b border-border pb-2">
      <div className="flex flex-col gap-1">
        <Heading as="h2" size="block">
          インタビュアー
        </Heading>
        <InterviewProgress fields={view.fields} />
      </div>
      {view.phase === "asking" && (
        <Button disabled={busy} onClick={onFinish} size="small" type="button" variant="secondary">
          ここで終える
        </Button>
      )}
    </header>
  );
}

export { InterviewHeader };
