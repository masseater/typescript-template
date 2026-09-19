import { PasskeyItem } from "./passkey-item";
import { StatusMessage } from "./shared/ui/status";
import { STATUS_VARIANT } from "./shared/ui/status-variants.ts";

import type { ReactElement } from "react";
import type { ActionState } from "./action";
import type { PasskeySummary } from "./mfa-types";

const PasskeyList = ({
  action,
  listError,
  passkeys,
}: {
  readonly action: ActionState;
  readonly listError: string | undefined;
  readonly passkeys: readonly PasskeySummary[] | undefined;
}): ReactElement => {
  if (listError !== undefined && listError !== "") {
    return <StatusMessage variant={STATUS_VARIANT.failure}>{listError}</StatusMessage>;
  }
  if (passkeys === undefined) {
    return (
      <StatusMessage variant={STATUS_VARIANT.pending}>パスキーを取得しています。</StatusMessage>
    );
  }
  if (passkeys.length === 0) {
    return <StatusMessage>登録されたパスキーはありません。</StatusMessage>;
  }
  return (
    <ul>
      {passkeys.map((passkey) => (
        <PasskeyItem action={action} key={passkey.id} passkey={passkey} />
      ))}
    </ul>
  );
};

export { PasskeyList };
