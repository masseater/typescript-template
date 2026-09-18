import { SecurityPage } from "@repo/ui/auth";
import { createFileRoute } from "@tanstack/react-router";

import uiStyles from "#app/auth.css?url";
import { serviceName } from "#shared/config/index.ts";

import type { ReactElement } from "react";

const Route = createFileRoute("/security")({
  component: (): ReactElement => <SecurityPage title={`${serviceName} の認証設定`} />,
  head: () => ({ links: [{ href: uiStyles, rel: "stylesheet" }] }),
});

export { Route };
