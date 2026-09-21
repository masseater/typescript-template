import { createFileRoute, redirect } from "@tanstack/react-router";

import {
  InvalidReportSearch,
  ReportsPage,
  loadReports,
  normalizeReportSearch,
} from "#pages/reports/index.ts";

import type { ReportSearch } from "#pages/reports/index.ts";

const Route = createFileRoute("/_admin/reports")({
  validateSearch: (search: unknown) => {
    try {
      return normalizeReportSearch(search);
    } catch (error) {
      if (error instanceof InvalidReportSearch) {
        throw redirect({ replace: true, search: {}, to: "/reports" });
      }
      throw error;
    }
  },
  loaderDeps: ({ search }: Readonly<{ search: ReportSearch }>) => search,
  loader: ({ deps }: Readonly<{ deps: ReportSearch }>) => loadReports(deps),
  component: function ReportsRoute() {
    return <ReportsPage listing={Route.useLoaderData()} search={Route.useSearch()} />;
  },
});

export { Route };
