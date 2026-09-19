import { createFileRoute } from "@tanstack/react-router";

import { AuditPage } from "#pages/audit/index.ts";

const Route = createFileRoute("/_dashboard/audit")({
  component: AuditPage,
});

export { Route };
