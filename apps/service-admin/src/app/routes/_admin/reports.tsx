import { reportStatuses } from "@repo/config";
import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";

import { ReportsPage, loadReports } from "#pages/reports/index.ts";

import type { ReportStatus } from "@repo/config";
import type { ReactElement } from "react";

const searchSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    page: Schema.optionalKey(Schema.FiniteFromString),
    status: Schema.optionalKey(Schema.Literals(reportStatuses)),
  }),
);

type ReportsSearch = Readonly<{
  page?: number | undefined;
  status?: ReportStatus | undefined;
}>;

type ReportsDeps = Readonly<{
  page: number;
  status?: ReportStatus;
}>;

const Route = createFileRoute("/_admin/reports")({
  component: ReportsRoute,
  validateSearch: searchSchema,
  loaderDeps: ({ search }: Readonly<{ search: ReportsSearch }>): ReportsDeps => ({
    page: search.page ?? 1,
    ...(search.status === undefined ? {} : { status: search.status }),
  }),
  loader: ({ deps }: Readonly<{ deps: ReportsDeps }>) =>
    loadReports({
      page: deps.page,
      ...(deps.status === undefined ? {} : { status: deps.status }),
    }),
});

function ReportsRoute(): ReactElement {
  const listing = Route.useLoaderData();
  const search = Route.useSearch();
  return <ReportsPage reports={listing.reports} status={search.status} />;
}

export { Route };
