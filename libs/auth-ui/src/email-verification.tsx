import { StatusMessage, STATUS_VARIANT } from "@repo/ui";
import { Effect, Fiber } from "effect";
import { useEffect, useState, type ReactElement } from "react";

import { verifyEmailToken } from "./verify-email-token.ts";

const EmailVerification = (): ReactElement => {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const verifying = Effect.runFork(
      Effect.map(
        Effect.promise(async () => verifyEmailToken()),
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
