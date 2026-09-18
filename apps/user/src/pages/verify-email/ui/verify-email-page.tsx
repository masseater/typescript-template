import { EmailVerification } from "@template/ui/auth";

import { CardPage } from "#shared/ui/index.ts";

import type { ReactElement } from "react";

const VerifyEmailPage = (): ReactElement => {
  return (
    <CardPage title="メールアドレスの確認">
      <EmailVerification />
    </CardPage>
  );
};

export { VerifyEmailPage };
