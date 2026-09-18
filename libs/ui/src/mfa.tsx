import { ActionStatus } from "./action-status";
import { Heading } from "./shared/ui/heading";
import { PasskeySettings } from "./passkey-settings";
import type { ReactElement } from "react";
import { RecoveryNotice } from "./recovery-notice";
import type { SessionView } from "./protocol";
import type { SettingsContext } from "./mfa-types";
import { TotpSettings } from "./totp-settings";
import { useAction } from "./action";
import { useNotice } from "./notice-state";

function readRecovery(): string | undefined {
  if (!("location" in globalThis)) {
    return undefined;
  }
  return new URLSearchParams(globalThis.location.search).get("recovery") ?? undefined;
}

function MFASettings({ session }: Readonly<{ session: SessionView }>): ReactElement {
  const { clearNotice, notice, showNotice } = useNotice();
  const recovery = readRecovery();
  const action = useAction();
  const context: SettingsContext = {
    action,
    onNotice: showNotice,
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
