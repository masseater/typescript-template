import { EmailVerification } from "./email-verification";
import { Page } from "./index";
import type { ReactElement } from "react";

function VerifyEmailPage(): ReactElement {
  return (
    <Page title="メールアドレスの確認">
      <EmailVerification />
    </Page>
  );
}

export { VerifyEmailPage };
