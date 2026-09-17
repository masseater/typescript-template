import { ActionStatus } from "./action-status";
import { Heading } from "./index";
import { PasskeySettings } from "./passkey-settings";
import type { ReactElement } from "react";
import { RecoveryNotice } from "./recovery-notice";
import type { SessionView } from "./protocol";
import type { SettingsContext } from "./mfa-types";
import { TotpSettings } from "./totp-settings";
import { useAction } from "./action";
import { useState } from "react";

function readRecovery(): string | undefined {
  if (!("location" in globalThis)) {
    return undefined;
  }
  return new URLSearchParams(globalThis.location.search).get("recovery") ?? undefined;
}

function MFASettings({ session }: Readonly<{ session: SessionView }>): ReactElement {
  const [notice, setNotice] = useState<string>();
  const recovery = readRecovery();
  const action = useAction();
  function clearNotice(): void {
    setNotice(undefined);
  }
  const context: SettingsContext = {
    action,
    onNotice: setNotice,
    onNoticeClear: clearNotice,
    recovery,
    session,
  };
  return (
    <div className="flex w-full flex-col gap-4">
      <Heading>認証アプリとパスキー</Heading>
      <RecoveryNotice recovery={recovery} role={session.user.role} />
      <TotpSettings context={context} />
      <Heading>パスキー</Heading>
      <PasskeySettings context={context} />
      <ActionStatus action={action} notice={notice} pendingMessage="認証設定を更新しています。" />
    </div>
  );
}

export { MFASettings };
