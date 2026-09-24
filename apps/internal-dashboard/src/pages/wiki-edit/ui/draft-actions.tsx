import { Button, ButtonAnchor } from "@repo/ui";

import type { ActionState } from "@repo/ui";
import type { ReactElement } from "react";

type DraftActionsProps = Readonly<{
  backHref: string;
  discarding: ActionState;
  onDiscard: () => void;
  onPublish: () => void;
  onSave: () => void;
  publishable: boolean;
  publishing: ActionState;
  saving: ActionState;
  version: number;
}>;

function DraftActions({
  backHref,
  discarding,
  onDiscard,
  onPublish,
  onSave,
  publishable,
  publishing,
  saving,
  version,
}: DraftActionsProps): ReactElement {
  const busy = saving.blocked || publishing.blocked;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        action={onSave}
        disabled={busy}
        type="button"
        variant={publishable ? "secondary" : "primary"}
      >
        下書きを保存
      </Button>
      {publishable ? (
        <Button action={onPublish} disabled={busy} type="button" variant="primary">
          保存した下書きを公開
        </Button>
      ) : null}
      {version === 0 ? null : (
        <Button
          disabled={discarding.blocked || busy}
          onClick={onDiscard}
          type="button"
          variant="danger"
        >
          下書きを捨てる
        </Button>
      )}
      <ButtonAnchor href={backHref} variant="secondary">
        ページに戻る
      </ButtonAnchor>
    </div>
  );
}

export { DraftActions };
