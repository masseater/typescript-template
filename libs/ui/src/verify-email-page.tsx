import { EmailVerification } from "./email-verification";
import { Page } from "./shared/ui";
import type { ReactElement } from "react";

function VerifyEmailPage(): ReactElement {
  return (
    <Page title="メールアドレスの確認">
      <EmailVerification />
    </Page>
  );
}

export { VerifyEmailPage };
