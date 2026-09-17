import { LoginForm } from "./login-form";
import { Page } from "./page";
import type { ReactElement } from "react";

function LoginPage({ title, signUp }: Readonly<{ title: string; signUp: boolean }>): ReactElement {
  return (
    <Page title={title}>
      <LoginForm />
      {signUp && <a href="/signup">新規登録</a>}
    </Page>
  );
}

export { LoginPage };
