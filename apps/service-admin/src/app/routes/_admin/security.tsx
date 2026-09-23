import { createFileRoute } from "@tanstack/react-router";

import { SecurityPage } from "#pages/security/index.ts";

const Route = createFileRoute("/_admin/security")({
  component: SecurityPage,
});

export { Route };
