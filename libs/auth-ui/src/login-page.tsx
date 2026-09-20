import { Page } from "@repo/ui";

import { LoginForm } from "./login-form";

import type { ReactElement } from "react";
import type { AuthenticatedHandler } from "./authenticated-handler";

const LoginPage = ({
  title,
  signUp,
  onAuthenticated,
}: Readonly<{
  title: string;
  signUp: boolean;
  onAuthenticated?: AuthenticatedHandler;
}>): ReactElement => {
  return (
    <Page title={title}>
      <LoginForm onAuthenticated={onAuthenticated} />
      {signUp && <a href="/signup">新規登録</a>}
    </Page>
  );
};

export { LoginPage };
