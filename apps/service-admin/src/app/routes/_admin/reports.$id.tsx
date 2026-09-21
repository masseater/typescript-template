import { createFileRoute } from "@tanstack/react-router";

import { ReportPage, loadReport } from "#pages/reports/index.ts";

const Route = createFileRoute("/_admin/reports/$id")({
  loader: ({ params }: Readonly<{ params: { readonly id: string } }>) => loadReport(params.id),
  component: function ReportRoute() {
    return <ReportPage report={Route.useLoaderData()} />;
  },
});

export { Route };
