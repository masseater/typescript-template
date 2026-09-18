import { createFileRoute } from "@tanstack/react-router";
import { SecurityPage } from "@template/ui/auth";

import type { ReactElement } from "react";

const Route = createFileRoute("/_member/security")({
  component: (): ReactElement => <SecurityPage title="認証設定" signedOutPath="/" />,
});

export { Route };
