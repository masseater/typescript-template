import { StatusMessage, STATUS_VARIANT } from "@repo/ui";
import { useQuery } from "@tanstack/react-query";
import { useEffect, type ReactElement } from "react";

import { emailVerificationOptions } from "./api/verify-email.ts";

const EmailVerification = (): ReactElement => {
  const verification = useQuery(emailVerificationOptions);
  const verified = verification.data;
  useEffect(() => {
    if (verified === undefined) {
      return;
    }
    if (verified) {
      globalThis.location.replace("/login");
      return;
    }
    globalThis.history.replaceState(undefined, "", globalThis.location.pathname);
  }, [verified]);
  return verified === false ? (
    <StatusMessage variant={STATUS_VARIANT.failure}>
      確認リンクが無効か、有効期限が切れています。ログインして確認メールを再送してください。
    </StatusMessage>
  ) : (
    <StatusMessage variant={STATUS_VARIANT.pending}>メールアドレスを確認しています。</StatusMessage>
  );
};

export { EmailVerification };
