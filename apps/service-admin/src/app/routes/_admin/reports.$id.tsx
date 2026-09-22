import { createFileRoute } from "@tanstack/react-router";

import { ReportRoute, loadReport } from "#pages/reports/index.ts";

const Route = createFileRoute("/_admin/reports/$id")({
  component: ReportRoute,
  loader: ({ params }: Readonly<{ params: Readonly<{ id: string }> }>) => loadReport(params.id),
});

export { Route };
