import type { ReactElement } from "react";
import { SecurityPage } from "@template/ui/auth";
import { createFileRoute } from "@tanstack/react-router";

const Route = createFileRoute("/_admin/security")({
  component: (): ReactElement => <SecurityPage title="認証設定" />,
});

export { Route };
