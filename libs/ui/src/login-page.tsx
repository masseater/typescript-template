import type { AuthenticatedHandler } from "./authenticated-handler";
import { LoginForm } from "./login-form";
import { Page } from "./shared/ui/page";
import type { ReactElement } from "react";

function LoginPage({
  title,
  signUp,
  onAuthenticated,
}: Readonly<{
  title: string;
  signUp: boolean;
  onAuthenticated?: AuthenticatedHandler;
}>): ReactElement {
  return (
    <Page title={title}>
      <LoginForm onAuthenticated={onAuthenticated} />
      {signUp && <a href="/signup">新規登録</a>}
    </Page>
  );
}

export { LoginPage };
