import { createFileRoute } from "@tanstack/react-router";
import { SecurityPage } from "@template/ui/auth";

export const Route = createFileRoute("/security")({
  component: () => <SecurityPage title="認証設定" />,
});
