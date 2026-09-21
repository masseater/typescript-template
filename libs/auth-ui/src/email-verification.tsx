import { useAtomValue } from "@effect/atom-react";
import { STATUS_VARIANT, StatusMessage, requestAtom, resultError } from "@repo/ui";
import { AsyncResult } from "effect/unstable/reactivity";

import { verifyEmailToken } from "./verify-email-token.ts";

import type { ReactElement } from "react";

const verificationAtom = requestAtom(async () => {
  const accepted = await verifyEmailToken();
  if (accepted) {
    globalThis.location.replace("/login");
  }
  return accepted;
});

const EmailVerification = (): ReactElement => {
  const verification = useAtomValue(verificationAtom);
  const failure = resultError(verification);
  if (failure !== undefined) {
    return <StatusMessage variant={STATUS_VARIANT.failure}>{failure}</StatusMessage>;
  }
  return AsyncResult.isSuccess(verification) && !verification.value ? (
    <StatusMessage variant={STATUS_VARIANT.failure}>
      確認リンクが無効か、有効期限が切れています。ログインして確認メールを再送してください。
    </StatusMessage>
  ) : (
    <StatusMessage variant={STATUS_VARIANT.pending}>メールアドレスを確認しています。</StatusMessage>
  );
};

export { EmailVerification };
