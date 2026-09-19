import { createFileRoute } from "@tanstack/react-router";

import { StaffPage } from "#pages/staff/index.ts";

const Route = createFileRoute("/_dashboard/staff")({
  component: StaffPage,
});

export { Route };
