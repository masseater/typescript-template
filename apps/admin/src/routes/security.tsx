import { createFileRoute } from "@tanstack/react-router";
import { SecurityPage } from "@template/ui/auth";

export const Route = createFileRoute("/security")({
  component: () => <SecurityPage title="管理者の認証設定" />,
});
