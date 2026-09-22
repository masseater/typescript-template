import { getRouteApi } from "@tanstack/react-router";

import { ReportPage } from "./report-page.tsx";

import type { ReactElement } from "react";

const route = getRouteApi("/_admin/reports/$id");

function ReportRoute(): ReactElement {
  return <ReportPage report={route.useLoaderData()} />;
}

export { ReportRoute };
