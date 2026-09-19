import { createFileRoute } from "@tanstack/react-router";

import { InquiriesPage } from "#pages/inquiries/index.ts";

const Route = createFileRoute("/_admin/inquiries")({
  component: InquiriesPage,
});

export { Route };
