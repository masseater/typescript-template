import type { Enrollment, SettingsContext } from "./mfa-types";
import { useCallback, useState } from "react";
import type { ReactElement } from "react";
import { Status } from "./status";
import { TotpEnrollment } from "./totp-enrollment";
import { TotpPasswordForm } from "./totp-password-form";

function TotpSettings({ context }: Readonly<{ context: SettingsContext }>): ReactElement {
  const [enrollment, setEnrollment] = useState<Enrollment>();
  const clearEnrollment = useCallback(() => {
    setEnrollment(undefined);
  }, []);
  return (
    <>
      <Status>
        {context.session.user.twoFactorEnabled
          ? "認証アプリは設定済みです。"
          : "認証アプリは未設定です。"}
      </Status>
      <p>
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
}

export { TotpSettings };
