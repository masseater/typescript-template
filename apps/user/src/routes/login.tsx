import { LoginPage } from "@template/ui/auth";
import type { ReactElement } from "react";
import { createFileRoute } from "@tanstack/react-router";

const Route = createFileRoute("/login")({
  component: (): ReactElement => <LoginPage title="ログイン" signUp />,
});

export { Route };
