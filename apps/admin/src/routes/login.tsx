import { LoginPage } from "@template/ui/auth";
import type { ReactElement } from "react";
import { createFileRoute } from "@tanstack/react-router";

const Route = createFileRoute("/login")({
  component: (): ReactElement => <LoginPage title="管理者ログイン" signUp={false} />,
});

export { Route };
