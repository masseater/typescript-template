import { SecurityPage } from "@repo/auth-ui";
import { createFileRoute } from "@tanstack/react-router";

import type { ReactElement } from "react";

const Route = createFileRoute("/_admin/security")({
  component: (): ReactElement => <SecurityPage title="認証設定" />,
});

export { Route };
