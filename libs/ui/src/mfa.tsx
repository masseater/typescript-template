import { useCallback, useMemo, useState } from "react";
import { ActionStatus } from "./action-status";
import { Heading } from "./shared/ui";
import { PasskeySettings } from "./passkey-settings";
import type { ReactElement } from "react";
import { RecoveryNotice } from "./recovery-notice";
import type { SessionView } from "./protocol";
import type { SettingsContext } from "./mfa-types";
import { TotpSettings } from "./totp-settings";
import { useAction } from "./action";

function readRecovery(): string | undefined {
  if (!("location" in globalThis)) {
    return undefined;
  }
  return new URLSearchParams(globalThis.location.search).get("recovery") ?? undefined;
}

function MFASettings({ session }: Readonly<{ session: SessionView }>): ReactElement {
  const [notice, setNotice] = useState<string>();
  const recovery = useMemo(() => readRecovery(), []);
  const action = useAction();
  const clearNotice = useCallback(() => {
    setNotice(undefined);
  }, []);
  const context = useMemo(
    (): SettingsContext => ({
      action,
      onNotice: setNotice,
      onNoticeClear: clearNotice,
      recovery,
      session,
    }),
    [action, clearNotice, recovery, session],
  );
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
