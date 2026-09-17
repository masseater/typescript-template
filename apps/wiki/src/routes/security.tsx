import { createFileRoute } from "@tanstack/react-router";
import { SecurityPage } from "@template/ui/auth";
import uiStyles from "@template/ui/styles.css?url";

export const Route = createFileRoute("/security")({
  head: () => ({ links: [{ rel: "stylesheet", href: uiStyles }] }),
  component: () => <SecurityPage title="Wiki の認証設定" />,
});
