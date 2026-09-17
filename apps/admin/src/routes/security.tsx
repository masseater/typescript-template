import type { ReactElement } from "react";
import { SecurityPage } from "@template/ui/auth";
import { createFileRoute } from "@tanstack/react-router";

const Route = createFileRoute("/security")({
  component: (): ReactElement => <SecurityPage title="管理者の認証設定" />,
});

export { Route };
