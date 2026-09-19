import { createFileRoute } from "@tanstack/react-router";

import { InquiriesPage } from "#pages/inquiries/index.ts";

const Route = createFileRoute("/_dashboard/inquiries")({
  component: InquiriesPage,
});

export { Route };
