import { useAction, ActionStatus, Heading } from "@repo/ui";
import { useState, type ReactElement } from "react";

import { PasskeySettings } from "./passkey-settings";
import { RecoveryNotice } from "./recovery-notice";
import { TotpSettings } from "./totp-settings";

import type { SettingsContext } from "./mfa-types";
import type { SessionView } from "./protocol";

const readRecovery = (): string | undefined => {
  if (!("location" in globalThis)) {
    return undefined;
  }
  return new URLSearchParams(globalThis.location.search).get("recovery") ?? undefined;
};

const MFASettings = ({ session }: Readonly<{ session: SessionView }>): ReactElement => {
  const [notice, setNotice] = useState<string>();
  const recovery = readRecovery();
  const action = useAction();
  const clearNotice = (): void => {
    setNotice(undefined);
  };
  const settingsContext: SettingsContext = {
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
      <TotpSettings context={settingsContext} />
      <Heading>パスキー</Heading>
      <PasskeySettings context={settingsContext} />
      <ActionStatus action={action} notice={notice} pendingMessage="認証設定を更新しています。" />
    </div>
  );
};

export { MFASettings };
