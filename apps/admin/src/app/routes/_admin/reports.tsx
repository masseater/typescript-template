import { createFileRoute } from "@tanstack/react-router";

import { ReportsPage } from "#pages/reports/index.ts";

const Route = createFileRoute("/_admin/reports")({
  component: ReportsPage,
});

export { Route };
