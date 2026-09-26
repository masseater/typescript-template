import { Page } from "@repo/ui";

import { EmailVerification } from "./email-verification";

import type { ReactElement } from "react";

const VerifyEmailPage = (): ReactElement => (
  <Page title="メールアドレスの確認">
    <EmailVerification />
  </Page>
);

export { VerifyEmailPage };
