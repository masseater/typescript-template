import type { ActionState } from "./action";
import { PasskeyItem } from "./passkey-item";
import type { PasskeySummary } from "./mfa-types";
import type { ReactElement } from "react";
import { Status } from "./index";

interface PasskeyListProps {
  readonly action: ActionState;
  readonly listError: string | undefined;
  readonly passkeys: readonly PasskeySummary[] | undefined;
}

function PasskeyList({ action, listError, passkeys }: PasskeyListProps): ReactElement {
  if (listError !== undefined && listError !== "") {
    return <Status variant="error">{listError}</Status>;
  }
  if (passkeys === undefined) {
    return <Status variant="pending">パスキーを取得しています。</Status>;
  }
  if (passkeys.length === 0) {
    return <Status>登録されたパスキーはありません。</Status>;
  }
  return (
    <ul>
      {passkeys.map((passkey) => (
        <PasskeyItem action={action} key={passkey.id} passkey={passkey} />
      ))}
    </ul>
  );
}

export { PasskeyList };
