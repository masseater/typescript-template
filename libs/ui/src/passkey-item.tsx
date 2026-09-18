import type { ActionState } from "./action";
import { Button } from "./shared/ui/button";
import type { PasskeySummary } from "./mfa-types";
import type { ReactElement } from "react";
import { authClient } from "./client";
import { requireSuccess } from "./protocol";

interface PasskeyItemProps {
  readonly action: ActionState;
  readonly passkey: PasskeySummary;
}

function passkeyLabel(name: string | null | undefined): string {
  return name === undefined || name === null || name === "" ? "名前のないパスキー" : name;
}

function PasskeyItem({ action, passkey }: PasskeyItemProps): ReactElement {
  function remove(): void {
    action.run(async () => {
      // oxlint-disable-next-line no-alert
      if (!globalThis.confirm("このパスキーを削除しますか？ 削除後は再ログインが必要です。")) {
        return;
      }
      requireSuccess(await authClient.passkey.deletePasskey({ id: passkey.id }));
      globalThis.location.assign("/login");
    });
  }
  return (
    <li>
      {passkeyLabel(passkey.name)}
      <Button type="button" disabled={action.blocked} onClick={remove}>
        削除
      </Button>
    </li>
  );
}

export { PasskeyItem };
