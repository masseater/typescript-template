import { useEffect, useState } from "react";

import { Status } from "./shared/ui/status";

import type { ReactElement } from "react";

type Verification = {
  readonly result: Promise<boolean>;
  readonly token: string;
};

let verification: Verification | undefined;

async function verifyEmailToken(): Promise<boolean> {
  const token = new URLSearchParams(globalThis.location.hash.slice(1)).get("token");
  if (token === null || token === "") {
    verification = undefined;
    return false;
  }
  if (verification?.token === token) {
    return verification.result;
  }
  const result = (async (): Promise<boolean> => {
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
  })();
  verification = { result, token };
  return result;
}

function EmailVerification(): ReactElement {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    async function verify(): Promise<void> {
      const ok = await verifyEmailToken();
      if (cancelled) {
        return;
      }
      if (ok) {
        globalThis.location.replace("/login");
        return;
      }
      globalThis.history.replaceState(undefined, "", globalThis.location.pathname);
      setFailed(true);
    }
    void verify();
    return (): void => {
      cancelled = true;
    };
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
