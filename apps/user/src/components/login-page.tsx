import { LoginForm } from "@template/ui/auth";
import { Page } from "@template/ui";
import type { ReactElement } from "react";

function LoginPage(): ReactElement {
  return (
    <Page title="ログイン">
      <LoginForm />
      <a href="/signup">新規登録</a>
    </Page>
  );
}

export { LoginPage };
