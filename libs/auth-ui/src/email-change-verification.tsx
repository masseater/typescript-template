import { StatusMessage, STATUS_VARIANT } from "@repo/ui";
import { Effect, Fiber } from "effect";
import { useEffect, useState, type ReactElement } from "react";

import { loginPath } from "./login-redirect.ts";
import { useSession } from "./use-session.ts";
import { verifyEmailToken } from "./verify-email-token.ts";

const ChangeConfirmationFragment = ({
  confirmed,
  retryHref,
}: Readonly<{ confirmed: boolean | undefined; retryHref: string }>): ReactElement => {
  if (confirmed === undefined) {
    return (
      <StatusMessage variant={STATUS_VARIANT.pending}>
        新しいメールアドレスを確認しています。
      </StatusMessage>
    );
  }
  return confirmed ? (
    <>
      <StatusMessage variant={STATUS_VARIANT.success}>
        メールアドレスを変更しました。次回からは新しいメールアドレスでログインしてください。
      </StatusMessage>
      <a href="/login">ログイン</a>
    </>
  ) : (
    <>
      <StatusMessage variant={STATUS_VARIANT.failure}>
        確認リンクが無効か、有効期限が切れています。もう一度メールアドレスの変更を申請してください。
      </StatusMessage>
      <a href={retryHref}>メールアドレスの変更へ</a>
      <a href="/login">ログイン</a>
    </>
  );
};

const SignInRequiredPrompt = (): ReactElement => {
  const currentLocation =
    "location" in globalThis ? `${globalThis.location.pathname}${globalThis.location.hash}` : "/";
  return (
    <>
      <StatusMessage variant={STATUS_VARIANT.info}>
        メールアドレスの変更を確定するには、ログインしてからこのリンクをもう一度開いてください。
      </StatusMessage>
      <a href={loginPath(currentLocation)}>ログイン</a>
    </>
  );
};

const useEmailChangeConfirmation = (signedIn: boolean): boolean | undefined => {
  const [confirmed, setConfirmed] = useState<boolean>();
  useEffect(() => {
    if (!signedIn) {
      return undefined;
    }
    const verifying = Effect.runFork(
      Effect.map(
        Effect.promise(async () => verifyEmailToken()),
        (verified) => {
          globalThis.history.replaceState(undefined, "", globalThis.location.pathname);
          setConfirmed(verified);
        },
      ),
    );
    return (): void => {
      Effect.runFork(Fiber.interrupt(verifying));
    };
  }, [signedIn]);
  return confirmed;
};

const EmailChangeVerification = ({ retryHref }: Readonly<{ retryHref: string }>): ReactElement => {
  const { session, loading, error } = useSession();
  const signedIn = !loading && session !== undefined;
  const confirmed = useEmailChangeConfirmation(signedIn);
  if (loading) {
    return <StatusMessage variant={STATUS_VARIANT.pending}>確認の準備をしています。</StatusMessage>;
  }
  if (error !== undefined) {
    return <StatusMessage variant={STATUS_VARIANT.failure}>{error}</StatusMessage>;
  }
  if (session === undefined) {
    return <SignInRequiredPrompt />;
  }
  return <ChangeConfirmationFragment confirmed={confirmed} retryHref={retryHref} />;
};

export { EmailChangeVerification };
