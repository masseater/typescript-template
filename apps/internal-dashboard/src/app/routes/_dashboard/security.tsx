import { SecurityPage } from "@repo/auth-ui";
import { createFileRoute } from "@tanstack/react-router";

import uiStyles from "#app/auth.css?url";
import { serviceName } from "#shared/config/index.ts";

import type { ReactElement } from "react";

const Route = createFileRoute("/_dashboard/security")({
  component: (): ReactElement => <SecurityPage title={`${serviceName} の認証設定`} />,
  head: () => ({ links: [{ href: uiStyles, rel: "stylesheet" }] }),
});

export { Route };
