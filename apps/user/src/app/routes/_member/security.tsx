import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { SecurityPage } from "@template/ui/auth";

const Route = createFileRoute("/_member/security")({
  component: (): ReactElement => <SecurityPage title="認証設定" signedOutPath="/" />,
});

export { Route };
