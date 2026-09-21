import { Button, STATUS_VARIANT, StatusMessage } from "@repo/ui";

import { useInterview } from "../model/use-interview.ts";
import { InterviewScreen } from "./screen.tsx";

import type { ReactElement } from "react";

function InterviewLoading({
  error,
  onReload,
  pending,
}: Readonly<{
  error: string | undefined;
  onReload: () => void;
  pending: boolean;
}>): ReactElement {
  if (error === undefined) {
    return <StatusMessage variant={STATUS_VARIANT.pending}>会話を読み込み中です。</StatusMessage>;
  }
  return (
    <div className="flex flex-col items-start gap-2">
      <StatusMessage variant={STATUS_VARIANT.failure}>{error}</StatusMessage>
      <Button disabled={pending} onClick={onReload} type="button" variant="secondary">
        再試行
      </Button>
    </div>
  );
}

function InterviewRoom({ onSaved }: Readonly<{ onSaved?: () => Promise<void> }>): ReactElement {
  const session = useInterview(onSaved);
  const finish = (): void => {
    session.say({ kind: "finish" });
  };
  if (session.view === undefined) {
    return (
      <InterviewLoading
        error={session.loadError}
        onReload={session.reload}
        pending={session.pending}
      />
    );
  }
  return (
    <InterviewScreen
      busy={session.busy}
      failure={session.failure}
      heard={session.heard}
      onFinish={finish}
      onRestart={session.restart}
      onRetry={session.retry}
      onSave={session.save}
      onSay={session.say}
      turnFailed={session.turnFailed}
      typing={session.typing}
      view={session.view}
    />
  );
}

export { InterviewRoom };
