import { StatusMessage, STATUS_VARIANT } from "@repo/ui";

import { EmailChangeConfirmation } from "./email-change-confirmation";
import { EmailChangeSignInPrompt } from "./email-change-sign-in-prompt";
import { useSession } from "./use-session.ts";

import type { ReactElement } from "react";

const EmailChangeVerification = ({ retryHref }: Readonly<{ retryHref: string }>): ReactElement => {
  const { session, loading, error } = useSession();
  if (loading) {
    return (
      <StatusMessage variant={STATUS_VARIANT.pending}>{"確認の準備をしています。"}</StatusMessage>
    );
  }
  if (error !== undefined) {
    return <StatusMessage variant={STATUS_VARIANT.failure}>{error}</StatusMessage>;
  }
  if (session === undefined) {
    return <EmailChangeSignInPrompt />;
  }
  return <EmailChangeConfirmation retryHref={retryHref} />;
};

export { EmailChangeVerification };
