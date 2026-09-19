import { useState, type ReactElement } from "react";

import { StatusMessage } from "./shared/ui/status";
import { STATUS_VARIANT } from "./shared/ui/status-variants.ts";
import { TotpEnrollment } from "./totp-enrollment";
import { TotpPasswordForm } from "./totp-password-form";

import type { Enrollment, SettingsContext } from "./mfa-types";

const TotpSettings = ({ context }: Readonly<{ context: SettingsContext }>): ReactElement => {
  const [enrollment, setEnrollment] = useState<Enrollment>();
  const clearEnrollment = (): void => {
    setEnrollment(undefined);
  };
  return (
    <>
      <StatusMessage
        variant={
          context.session.user.twoFactorEnabled ? STATUS_VARIANT.success : STATUS_VARIANT.info
        }
      >
        {context.session.user.twoFactorEnabled
          ? "認証アプリは設定済みです。"
          : "認証アプリは未設定です。"}
      </StatusMessage>
      <p className="text-sm text-muted-foreground">
        設定用 URI
        とバックアップコードは秘密情報です。ログやチャットに貼らず、安全な場所に保管してください。
      </p>
      <TotpPasswordForm
        context={context}
        enrolling={enrollment !== undefined}
        onEnroll={setEnrollment}
      />
      {enrollment !== undefined && (
        <TotpEnrollment
          action={context.action}
          enrollment={enrollment}
          onVerified={clearEnrollment}
        />
      )}
    </>
  );
};

export { TotpSettings };
