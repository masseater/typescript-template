import { useState, type ReactElement } from "react";

import { Status } from "./shared/ui/status";
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
      <Status variant={context.session.user.twoFactorEnabled ? "success" : "info"}>
        {context.session.user.twoFactorEnabled
          ? "認証アプリは設定済みです。"
          : "認証アプリは未設定です。"}
      </Status>
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
