import { Effect, Fiber, Ref } from "effect";
import { useEffect, useState, type ReactElement } from "react";

import { StatusMessage } from "./shared/ui/status";
import { STATUS_VARIANT } from "./shared/ui/status-variants.ts";

const verificationEndpoint = "/api/verify-email";

const pendingVerification = Effect.runSync(
  Ref.make<{ readonly result: Promise<boolean>; readonly token: string } | undefined>(undefined),
);

const verifyEmailToken = async (endpoint: string): Promise<boolean> => {
  const token = new URLSearchParams(globalThis.location.hash.slice(1)).get("token");
  if (token === null || token === "") {
    Effect.runSync(Ref.set(pendingVerification, undefined));
    return false;
  }
  const cached = Effect.runSync(Ref.get(pendingVerification));
  if (cached?.token === token) {
    return cached.result;
  }
  const accepted = (async (): Promise<boolean> => {
    const [settled] = await Promise.allSettled([
      fetch(endpoint, {
        body: JSON.stringify({ token }),
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    ]);
    return settled.status === "fulfilled" && settled.value.ok;
  })();
  Effect.runSync(Ref.set(pendingVerification, { result: accepted, token }));
  return accepted;
};

const EmailVerification = (): ReactElement => {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const verifying = Effect.runFork(
      Effect.map(
        Effect.promise(() => verifyEmailToken(verificationEndpoint)),
        (verified) => {
          if (verified) {
            globalThis.location.replace("/login");
            return;
          }
          globalThis.history.replaceState(undefined, "", globalThis.location.pathname);
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
