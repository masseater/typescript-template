import { type ActionState, Button, ConfirmDialog } from "@repo/ui";
import { useState, type ReactElement } from "react";

import { authClient } from "./client";
import { requireSuccess } from "./protocol";

import type { PasskeySummary } from "./mfa-types";

const passkeyLabel = (storedName: string | null | undefined): string => {
  return storedName === undefined || storedName === null || storedName === ""
    ? "名前のないパスキー"
    : storedName;
};

const PasskeyItem = ({
  action,
  passkey,
}: {
  readonly action: ActionState;
  readonly passkey: PasskeySummary;
}): ReactElement => {
  const [confirming, setConfirming] = useState(false);
  const displayedPasskeyName = passkeyLabel(passkey.name);
  const remove = (): void => {
    setConfirming(false);
    action.run(async () => {
      requireSuccess(await authClient.passkey.deletePasskey({ id: passkey.id }));
      globalThis.location.assign("/login");
    });
  };
  return (
    <li>
      {displayedPasskeyName}
      <Button
        type="button"
        disabled={action.blocked}
        onClick={() => {
          setConfirming(true);
        }}
      >
        削除
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`${displayedPasskeyName}を削除しますか？`}
        description="削除後は再ログインが必要です。この操作は取り消せません。"
        confirmLabel="削除する"
        variant="danger"
        onConfirm={remove}
      />
    </li>
  );
};

export { PasskeyItem };
