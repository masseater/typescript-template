import type { ReactElement } from "react";
import { useState } from "react";

import { useAction } from "./action";
import { ActionStatus } from "./action-status";
import type { SettingsContext } from "./mfa-types";
import { PasskeySettings } from "./passkey-settings";
import type { SessionView } from "./protocol";
import { RecoveryNotice } from "./recovery-notice";
import { Heading } from "./shared/ui/heading";
import { TotpSettings } from "./totp-settings";

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
