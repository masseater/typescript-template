import { Button, ConfirmDialog, localState } from "@repo/ui";

import { InterviewComposer } from "./composer.tsx";
import { HistoryConsentPanel } from "./history-consent.tsx";
import { InterviewReply } from "./reply.tsx";

import type { ReactElement } from "react";
import type { InterviewViewData, MemberUtterance } from "../api/interview.ts";

const useRestartConfirm = localState(false);

function InterviewRestart({
  busy,
  onRestart,
}: Readonly<{ busy: boolean; onRestart: () => void }>): ReactElement {
  const [open, setOpen] = useRestartConfirm();
  const handleOpen = (): void => {
    setOpen(true);
  };
  const handleOpenChange = (next: boolean): void => {
    setOpen(next);
  };
  const handleConfirm = (): void => {
    setOpen(false);
    onRestart();
  };
  return (
    <>
      <Button disabled={busy} onClick={handleOpen} type="button" variant="danger">
        最初からやり直す
      </Button>
      <ConfirmDialog
        confirmLabel="やり直す"
        description="会話とシートを消して最初からやり直します。取り消せません。"
        onConfirm={handleConfirm}
        onOpenChange={handleOpenChange}
        open={open}
        title="最初からやり直しますか？"
        variant="danger"
      />
    </>
  );
}

function InterviewActions({
  busy,
  failure,
  onConsent,
  onRestart,
  onSave,
  onSay,
  view,
}: Readonly<{
  busy: boolean;
  failure: string | undefined;
  onConsent: (accept: boolean) => void;
  onRestart: () => void;
  onSave: () => void;
  onSay: (utterance: MemberUtterance) => void;
  view: InterviewViewData;
}>): ReactElement {
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3">
      {view.phase === "asking" && (
        <InterviewReply
          disabled={busy}
          onSay={onSay}
          questionKey={String(view.messages.length)}
          reply={view.reply}
        />
      )}
      {view.phase === "summary" && (
        <Button disabled={busy} onClick={onSave} type="button" variant="primary">
          この内容で保存
        </Button>
      )}
      {view.phase === "history_consent" && (
        <HistoryConsentPanel blocked={busy} error={failure} onRespond={onConsent} />
      )}
      {view.phase === "saved" && <InterviewRestart busy={busy} onRestart={onRestart} />}
      {view.phase !== "history_consent" && <InterviewComposer disabled={busy} onSay={onSay} />}
    </div>
  );
}

export { InterviewActions };
