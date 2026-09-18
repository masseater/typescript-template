import { serverQuery, useServerQuery } from "./server-query";
import type { ReactElement } from "react";
import { Status } from "./shared/ui/status";
import { request } from "./request";

async function verifyEmailToken(): Promise<boolean> {
  const token = new URLSearchParams(globalThis.location.hash.slice(1)).get("token");
  if (token === null || token === "") {
    return false;
  }
  const response = await fetch("/api/verify-email", {
    body: JSON.stringify({ token }),
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  globalThis.history.replaceState(undefined, "", globalThis.location.pathname);
  if (response.ok) {
    globalThis.location.replace("/login");
  }
  return response.ok;
}

const verificationQuery = serverQuery(["email-verification"], request(verifyEmailToken));

function EmailVerification(): ReactElement {
  const result = useServerQuery(verificationQuery);
  if (result.status === "failure") {
    return <Status variant="error">{result.message}</Status>;
  }
  return result.status === "success" && !result.value ? (
    <Status variant="error">
      確認リンクが無効か、有効期限が切れています。ログインして確認メールを再送してください。
    </Status>
  ) : (
    <Status variant="pending">メールアドレスを確認しています。</Status>
  );
}

export { EmailVerification };
