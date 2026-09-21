import { ActionStatus, Heading, useAction } from "@repo/ui";

import { PasskeyList } from "./passkey-list";
import { PasskeyRegisterForm } from "./passkey-register-form";
import { TotpSettings } from "./totp-settings";
import { useNotice } from "./use-notice";

import type { ReactElement } from "react";
import type { PasskeySummary, SettingsContext } from "./mfa-types";
import type { SessionView } from "./protocol";

const AccountSecurity = ({
  passkeys,
  session,
}: Readonly<{
  passkeys: readonly PasskeySummary[];
  session: SessionView;
}>): ReactElement => {
  const { clearNotice, notice, showNotice } = useNotice();
  const action = useAction();
  const context: SettingsContext = {
    action,
    onNotice: showNotice,
    onNoticeClear: clearNotice,
    recovery: undefined,
    session,
  };
  return (
    <div className="flex w-full flex-col gap-4">
      <Heading>認証アプリとパスキー</Heading>
      <TotpSettings context={context} />
      <Heading>パスキー</Heading>
      <PasskeyRegisterForm
        context={context}
        onRegistered={() => Promise.resolve()}
      />
      <PasskeyList action={action} listError={undefined} passkeys={passkeys} />
      <ActionStatus action={action} notice={notice} pendingMessage="認証設定を更新しています。" />
    </div>
  );
};

export { AccountSecurity };
