import { createFileRoute } from "@tanstack/react-router";

import { ReportPage, loadReport } from "#pages/reports/index.ts";

import type { ReactElement } from "react";

const Route = createFileRoute("/_admin/reports/$id")({
  component: ReportRoute,
  loader: async ({ params }: Readonly<{ params: Readonly<{ id: string }> }>) =>
    loadReport(params.id),
});

function ReportRoute(): ReactElement {
  return <ReportPage report={Route.useLoaderData()} />;
}

export { Route };
