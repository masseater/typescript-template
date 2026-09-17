import { createFileRoute } from "@tanstack/react-router";
import { Page } from "@template/ui";
import { EmailVerification } from "@template/ui/auth";

export const Route = createFileRoute("/verify-email")({ component: VerifyEmail });
function VerifyEmail() {
  return (
    <Page title="メールアドレスの確認">
      <EmailVerification />
    </Page>
  );
}
