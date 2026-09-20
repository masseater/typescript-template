import { AUTHENTICATION_METHOD, type StrongAuthenticationMethod } from "@repo/config";
import { type ActionState, type TextInput, Button, STATUS_VARIANT, StatusMessage } from "@repo/ui";

import { TotpField } from "./totp-field";
import { usePasskeys } from "./use-passkeys";

import type { ReactElement } from "react";
import type { SessionView } from "./protocol";

const StrongAuthControls = ({
  action,
  code,
  onConfirm,
  securityHref,
  session,
}: Readonly<{
  action: ActionState;
  code: TextInput;
  onConfirm: (method: StrongAuthenticationMethod) => void;
  securityHref: string;
  session: SessionView;
}>): ReactElement => {
  const { passkeys } = usePasskeys();
  const confirmWithPasskey = (): void => {
    onConfirm(AUTHENTICATION_METHOD.passkey);
  };
  const passkeyEnrolled = passkeys !== undefined && passkeys.length > 0;
  return (
    <>
      {!session.user.twoFactorEnabled && !passkeyEnrolled && (
        <StatusMessage variant={STATUS_VARIANT.info}>
          変更には認証アプリかパスキーでの確認が必要です。先に
          <a href={securityHref}>セキュリティ</a>で設定してください。
        </StatusMessage>
      )}
      {session.user.twoFactorEnabled && (
        <>
          <TotpField code={code} />
          <Button type="submit" variant="primary" disabled={action.blocked}>
            確認コードで確認して変更する
          </Button>
        </>
      )}
      {passkeyEnrolled && (
        <Button type="button" disabled={action.blocked} onClick={confirmWithPasskey}>
          パスキーで確認して変更する
        </Button>
      )}
    </>
  );
};

export { StrongAuthControls };
