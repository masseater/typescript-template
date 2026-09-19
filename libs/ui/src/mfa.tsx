import { AUTHENTICATION_METHOD } from "@repo/config";
import { useState } from "react";

import { useAction } from "./action";
import { ActionStatus } from "./action-status";
import { PasskeySettings } from "./passkey-settings";
import { RecoveryNotice } from "./recovery-notice";
import { Heading } from "./shared/ui/heading";
import { TotpSettings } from "./totp-settings";

import type { ReactElement } from "react";
import type { SettingsContext } from "./mfa-types";
import type { SessionView } from "./protocol";

function readRecovery(): string | undefined {
  if (!("location" in globalThis)) {
    return undefined;
  }
  return (
    new URLSearchParams(globalThis.location.search).get(AUTHENTICATION_METHOD.recovery) ?? undefined
  );
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
