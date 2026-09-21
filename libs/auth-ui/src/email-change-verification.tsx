import { useAtomValue } from "@effect/atom-react";
import { StatusMessage, STATUS_VARIANT, requestAtom, resultError } from "@repo/ui";
import { AsyncResult } from "effect/unstable/reactivity";

import { loginPath } from "./login-redirect.ts";
import { useSession } from "./use-session.ts";
import { verifyEmailToken } from "./verify-email-token.ts";

import type { ReactElement } from "react";

const confirmationAtom = requestAtom(async () => {
  const verified = await verifyEmailToken();
  globalThis.history.replaceState(undefined, "", globalThis.location.pathname);
  return verified;
});

const ChangeConfirmationFragment = ({
  retryHref,
}: Readonly<{ retryHref: string }>): ReactElement => {
  const confirmation = useAtomValue(confirmationAtom);
  const failure = resultError(confirmation);
  if (failure !== undefined) {
    return <StatusMessage variant={STATUS_VARIANT.failure}>{failure}</StatusMessage>;
  }
  if (!AsyncResult.isSuccess(confirmation)) {
    return (
      <StatusMessage variant={STATUS_VARIANT.pending}>
        新しいメールアドレスを確認しています。
      </StatusMessage>
    );
  }
  return confirmation.value ? (
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

const EmailChangeVerification = ({ retryHref }: Readonly<{ retryHref: string }>): ReactElement => {
  const { session, loading, error } = useSession();
  if (loading) {
    return <StatusMessage variant={STATUS_VARIANT.pending}>確認の準備をしています。</StatusMessage>;
  }
  if (error !== undefined) {
    return <StatusMessage variant={STATUS_VARIANT.failure}>{error}</StatusMessage>;
  }
  if (session === undefined) {
    return <SignInRequiredPrompt />;
  }
  return <ChangeConfirmationFragment retryHref={retryHref} />;
};

export { EmailChangeVerification };
