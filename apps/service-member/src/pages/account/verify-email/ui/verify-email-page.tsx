import { EmailVerification } from "@repo/auth-ui";

import { CardPage } from "#shared/ui/index.ts";

import type { ReactElement } from "react";

function VerifyEmailPage(): ReactElement {
  return (
    <CardPage title="メールアドレスの確認">
      <EmailVerification />
    </CardPage>
  );
}

export { VerifyEmailPage };
