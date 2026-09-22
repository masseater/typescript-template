import { createFileRoute } from "@tanstack/react-router";

import uiStyles from "#app/auth.css?url";
import { SecurityPage } from "#pages/security/index.ts";

const Route = createFileRoute("/_dashboard/security")({
  component: SecurityPage,
  head: () => ({ links: [{ href: uiStyles, rel: "stylesheet" }] }),
});

export { Route };
