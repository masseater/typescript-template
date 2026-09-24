import { getRouteApi } from "@tanstack/react-router";

import { ReportsPage } from "./reports-page.tsx";

import type { ReactElement } from "react";

const route = getRouteApi("/_admin/reports");

function ReportsRoute(): ReactElement {
  const listing = route.useLoaderData();
  const search = route.useSearch();
  return <ReportsPage reports={listing.reports} status={search.status} />;
}

export { ReportsRoute };
