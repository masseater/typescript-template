import { reportStatuses } from "@repo/config";
import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";

import { ReportsPage, loadReports } from "#pages/reports/index.ts";

import type { ReactElement } from "react";

const searchSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    page: Schema.optionalKey(Schema.NumberFromString),
    status: Schema.optionalKey(Schema.Literals(reportStatuses)),
  }),
);

type ReportsSearch = Readonly<{
  page?: number | undefined;
  status?: (typeof reportStatuses)[number] | undefined;
}>;

const Route = createFileRoute("/_admin/reports")({
  component: ReportsRoute,
  loader: async ({ search }: Readonly<{ search: ReportsSearch }>) =>
    loadReports({ page: search.page ?? 1, status: search.status }),
  validateSearch: searchSchema,
});

function ReportsRoute(): ReactElement {
  const listing = Route.useLoaderData();
  const search = Route.useSearch();
  return <ReportsPage reports={listing.reports} status={search.status} />;
}

export { Route };
