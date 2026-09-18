import type { Enrollment, SettingsContext } from "./mfa-types";
import { Option } from "effect";
import type { ReactElement } from "react";
import { Status } from "./shared/ui/status";
import { TotpEnrollment } from "./totp-enrollment";
import { TotpPasswordForm } from "./totp-password-form";
import { localState } from "./local-state";

const useEnrollment = localState(Option.none<Enrollment>());

function TotpSettings({ context }: Readonly<{ context: SettingsContext }>): ReactElement {
  const [enrollment, setEnrollment] = useEnrollment();
  function enroll(started: Enrollment): void {
    setEnrollment(Option.some(started));
  }
  function clearEnrollment(): void {
    setEnrollment(Option.none());
  }
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
      <TotpPasswordForm context={context} enrolling={Option.isSome(enrollment)} onEnroll={enroll} />
      {Option.isSome(enrollment) && (
        <TotpEnrollment
          action={context.action}
          enrollment={enrollment.value}
          onVerified={clearEnrollment}
        />
      )}
    </>
  );
}

export { TotpSettings };
