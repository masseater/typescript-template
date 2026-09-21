import { Button, localState } from "@repo/ui";

import type { ReactElement } from "react";

const useConfirmingRestart = localState(false);

function InterviewRestart({
  disabled,
  onRestart,
}: Readonly<{ disabled: boolean; onRestart: () => void }>): ReactElement {
  const [confirming, setConfirming] = useConfirmingRestart();
  if (!confirming) {
    return (
      <Button
        disabled={disabled}
        onClick={() => {
          setConfirming(true);
        }}
        type="button"
      >
        最初からやり直す
      </Button>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">会話とシートを消します。取り消せません。</p>
      <div className="flex gap-2">
        <Button disabled={disabled} onClick={onRestart} type="button" variant="danger">
          やり直す
        </Button>
        <Button
          disabled={disabled}
          onClick={() => {
            setConfirming(false);
          }}
          type="button"
        >
          戻る
        </Button>
      </div>
    </div>
  );
}

export { InterviewRestart };
