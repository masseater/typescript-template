import { EmailChangeVerification } from "@repo/auth-ui";

import { CardPage } from "#shared/ui/index.ts";

import type { ReactElement } from "react";

function VerifyEmailChangePage(): ReactElement {
  return (
    <CardPage title="新しいメールアドレスの確認">
      <EmailChangeVerification retryHref="/settings/email" />
    </CardPage>
  );
}

export { VerifyEmailChangePage };
