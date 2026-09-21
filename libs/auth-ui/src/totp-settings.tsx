import { StatusMessage, STATUS_VARIANT, localState } from "@repo/ui";
import { Option } from "effect";

import { TotpEnrollment } from "./totp-enrollment";
import { TotpPasswordForm } from "./totp-password-form";

import type { ReactElement } from "react";
import type { Enrollment, SettingsContext } from "./mfa-types";

const useEnrollment = localState(Option.none<Enrollment>());

const TotpSettings = ({ context }: Readonly<{ context: SettingsContext }>): ReactElement => {
  const [enrollment, setEnrollment] = useEnrollment();
  const enroll = (started: Enrollment): void => {
    setEnrollment(Option.some(started));
  };
  const clearEnrollment = (): void => {
    setEnrollment(Option.none());
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
        設定用のリンクとバックアップコードは秘密情報です。ログやチャットに貼らず、安全な場所に保管してください。
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
};

export { TotpSettings };
