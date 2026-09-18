import { authClient } from "./client";
import { requireSuccess } from "./protocol";
import { Button } from "./shared/ui/button";

import type { ReactElement } from "react";
import type { ActionState } from "./action";
import type { PasskeySummary } from "./mfa-types";

type PasskeyItemProps = {
  readonly action: ActionState;
  readonly passkey: PasskeySummary;
};

const passkeyLabel = (name: string | null | undefined): string => {
  return name === undefined || name === null || name === "" ? "名前のないパスキー" : name;
};

const PasskeyItem = ({ action, passkey }: PasskeyItemProps): ReactElement => {
  const remove = (): void => {
    action.run(async () => {
      if (!globalThis.confirm("このパスキーを削除しますか？ 削除後は再ログインが必要です。")) {
        return;
      }
      requireSuccess(await authClient.passkey.deletePasskey({ id: passkey.id }));
      globalThis.location.assign("/login");
    });
  };
  return (
    <li>
      {passkeyLabel(passkey.name)}
      <Button type="button" disabled={action.blocked} onClick={remove}>
        削除
      </Button>
    </li>
  );
};

export { PasskeyItem };
