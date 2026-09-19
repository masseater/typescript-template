import { Effect, Fiber } from "effect";
import { useEffect, useState, type ReactElement } from "react";

import { StatusMessage } from "./shared/ui/status";
import { STATUS_VARIANT } from "./shared/ui/status-variants.ts";

const verificationEndpoint = "/api/verify-email";

const verifyEmailToken = async (endpoint: string): Promise<boolean> => {
  const token = new URLSearchParams(globalThis.location.hash.slice(1)).get("token");
  globalThis.history.replaceState(undefined, "", globalThis.location.pathname);
  if (token === null || token === "") {
    return false;
  }
  const [verification] = await Promise.allSettled([
    fetch(endpoint, {
      body: JSON.stringify({ token }),
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      method: "POST",
    }),
  ]);
  return verification.status === "fulfilled" && verification.value.ok;
};

const EmailVerification = (): ReactElement => {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const verifying = Effect.runFork(
      Effect.map(
        Effect.promise(async () => verifyEmailToken(verificationEndpoint)),
        (verified) => {
          if (verified) {
            globalThis.location.replace("/login");
            return;
          }
          setFailed(true);
        },
      ),
    );
    return (): void => {
      Effect.runFork(Fiber.interrupt(verifying));
    };
  }, []);
  return failed ? (
    <StatusMessage variant={STATUS_VARIANT.failure}>
      確認リンクが無効か、有効期限が切れています。ログインして確認メールを再送してください。
    </StatusMessage>
  ) : (
    <StatusMessage variant={STATUS_VARIANT.pending}>メールアドレスを確認しています。</StatusMessage>
  );
};

export { EmailVerification };
