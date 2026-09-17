import { Page } from "@template/ui";
import type { ReactElement } from "react";
import { SignUpForm } from "@template/ui/signup";

function SignUpPage(): ReactElement {
  return (
    <Page title="ユーザー登録">
      <SignUpForm />
      <a href="/login">ログインへ</a>
    </Page>
  );
}

export { SignUpPage };
