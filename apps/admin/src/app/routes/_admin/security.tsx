import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { SecurityPage } from "@repo/ui/auth";

const Route = createFileRoute("/_admin/security")({
  component: (): ReactElement => <SecurityPage title="認証設定" />,
});

export { Route };
