import { createFileRoute } from "@tanstack/react-router";
import { Page } from "@template/ui/ui";
import { SignUpForm } from "@template/ui/signup";

export const Route = createFileRoute("/signup")({ component: SignUp });
function SignUp() {
  return (
    <Page title="ユーザー登録">
      <SignUpForm />
      <a href="/login">ログインへ</a>
    </Page>
  );
}
