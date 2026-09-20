import { SecurityPage } from "@repo/auth-ui";
import { createFileRoute } from "@tanstack/react-router";

import type { ReactElement } from "react";

const Route = createFileRoute("/_member/settings/security")({
  component: (): ReactElement => <SecurityPage title="セキュリティ" signedOutPath="/" />,
});

export { Route };
