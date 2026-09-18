import type { ReactElement } from "react";
import { SecurityPage } from "@template/ui/auth";
import { createFileRoute } from "@tanstack/react-router";
import { serviceName } from "#shared/config/index.ts";
import uiStyles from "#app/auth.css?url";

const Route = createFileRoute("/security")({
  component: (): ReactElement => <SecurityPage title={`${serviceName} の認証設定`} />,
  head: () => ({ links: [{ href: uiStyles, rel: "stylesheet" }] }),
});

export { Route };
