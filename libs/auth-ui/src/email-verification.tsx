import { useAtomValue } from "@effect/atom-react";
import { STATUS_VARIANT, StatusMessage, requestAtom, resultError } from "@repo/ui";
import { AsyncResult } from "effect/unstable/reactivity";

import type { ReactElement } from "react";

const verificationEndpoint = "/api/verify-email";

const verifyEmailToken = async (endpoint: string): Promise<boolean> => {
  const token = new URLSearchParams(globalThis.location.hash.slice(1)).get("token");
  if (token === null || token === "") {
    return false;
  }
  const served = await fetch(endpoint, {
    body: JSON.stringify({ token }),
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  if (served.ok) {
    globalThis.location.replace("/login");
    return true;
  }
  globalThis.history.replaceState(undefined, "", globalThis.location.pathname);
  return false;
};

const verificationAtom = requestAtom(async () => verifyEmailToken(verificationEndpoint));

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
