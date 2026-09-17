import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "@template/ui/auth";

export const Route = createFileRoute("/login")({
  component: () => <LoginPage title="管理者ログイン" signUp={false} />,
});
