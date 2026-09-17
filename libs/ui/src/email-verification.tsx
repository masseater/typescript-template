import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { Status } from "./shared/ui";

async function verifyEmailToken(): Promise<boolean> {
  const token = new URLSearchParams(globalThis.location.hash.slice(1)).get("token");
  globalThis.history.replaceState(undefined, "", globalThis.location.pathname);
  if (token === null || token === "") {
    return false;
  }
  try {
    const response = await fetch("/api/verify-email", {
      body: JSON.stringify({ token }),
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    return response.ok;
  } catch {
    return false;
  }
}

function EmailVerification(): ReactElement {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    async function verify(): Promise<void> {
      if (await verifyEmailToken()) {
        globalThis.location.replace("/login");
        return;
      }
      setFailed(true);
    }
    void verify();
  }, []);
  return failed ? (
    <Status variant="error">
      確認リンクが無効か、有効期限が切れています。ログインして確認メールを再送してください。
    </Status>
  ) : (
    <Status variant="pending">メールアドレスを確認しています。</Status>
  );
}

export { EmailVerification };
