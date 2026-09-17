import { createFileRoute } from "@tanstack/react-router";
import { Page } from "@template/ui";
import { LoginForm } from "@template/ui/auth";

export const Route = createFileRoute("/login")({ component: Login });
function Login() {
  return (
    <Page title="管理者ログイン">
      <LoginForm />
    </Page>
  );
}
