import { requestAtom, resultError } from "./request";
import { AsyncResult } from "effect/unstable/reactivity";
import type { ReactElement } from "react";
import { Status } from "./shared/ui/status";
import { useAtomValue } from "@effect/atom-react";

async function verifyEmailToken(): Promise<boolean> {
  const token = new URLSearchParams(globalThis.location.hash.slice(1)).get("token");
  globalThis.history.replaceState(undefined, "", globalThis.location.pathname);
  if (token === null || token === "") {
    return false;
  }
  const response = await fetch("/api/verify-email", {
    body: JSON.stringify({ token }),
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  if (response.ok) {
    globalThis.location.replace("/login");
  }
  return response.ok;
}

const verificationAtom = requestAtom(verifyEmailToken);

function EmailVerification(): ReactElement {
  const result = useAtomValue(verificationAtom);
  const error = resultError(result);
  if (error !== undefined) {
    return <Status variant="error">{error}</Status>;
  }
  return AsyncResult.isSuccess(result) && !result.value ? (
    <Status variant="error">
      確認リンクが無効か、有効期限が切れています。ログインして確認メールを再送してください。
    </Status>
  ) : (
    <Status variant="pending">メールアドレスを確認しています。</Status>
  );
}

export { EmailVerification };
