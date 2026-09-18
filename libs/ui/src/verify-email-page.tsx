import type { ReactElement } from "react";

import { EmailVerification } from "./email-verification";
import { Page } from "./shared/ui/page";

function VerifyEmailPage(): ReactElement {
  return (
    <Page title="メールアドレスの確認">
      <EmailVerification />
    </Page>
  );
}

export { VerifyEmailPage };
