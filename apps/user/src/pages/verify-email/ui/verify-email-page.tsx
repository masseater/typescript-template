import type { ReactElement } from "react";

import { CardPage } from "#shared/ui/index.ts";
import { EmailVerification } from "@repo/ui/auth";

function VerifyEmailPage(): ReactElement {
  return (
    <CardPage title="メールアドレスの確認">
      <EmailVerification />
    </CardPage>
  );
}

export { VerifyEmailPage };
