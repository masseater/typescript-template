import { LoginForm } from "@template/ui/auth";
import { Page } from "@template/ui";
import type { ReactElement } from "react";

function LoginPage(): ReactElement {
  return (
    <Page title="管理者ログイン">
      <LoginForm />
    </Page>
  );
}

export { LoginPage };
