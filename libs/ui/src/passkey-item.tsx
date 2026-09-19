import { useState } from "react";

import { authClient } from "./client";
import { requireSuccess } from "./protocol";
import { Button } from "./shared/ui/button";
import { ConfirmDialog } from "./shared/ui/confirm-dialog";

import type { ReactElement } from "react";
import type { ActionState } from "./action";
import type { PasskeySummary } from "./mfa-types";

interface PasskeyItemProps {
  readonly action: ActionState;
  readonly passkey: PasskeySummary;
}

function passkeyLabel(name: string | null | undefined): string {
  return name === undefined || name === null || name === "" ? "名前のないパスキー" : name;
}

function PasskeyItem({ action, passkey }: PasskeyItemProps): ReactElement {
  const [confirming, setConfirming] = useState(false);
  const label = passkeyLabel(passkey.name);
  function remove(): void {
    setConfirming(false);
    action.run(async () => {
      requireSuccess(await authClient.passkey.deletePasskey({ id: passkey.id }));
      globalThis.location.assign("/login");
    });
  }
  return (
    <li>
      {label}
      <Button type="button" disabled={action.blocked} onClick={() => setConfirming(true)}>
        削除
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`${label}を削除しますか？`}
        description="削除後は再ログインが必要です。この操作は取り消せません。"
        confirmLabel="削除する"
        variant="danger"
        onConfirm={remove}
      />
    </li>
  );
}

export { PasskeyItem };
