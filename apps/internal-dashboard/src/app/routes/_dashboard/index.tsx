import { createFileRoute } from "@tanstack/react-router";

import { OverviewPage } from "#pages/overview/index.ts";

const Route = createFileRoute("/_dashboard/")({
  component: OverviewPage,
});

export { Route };
