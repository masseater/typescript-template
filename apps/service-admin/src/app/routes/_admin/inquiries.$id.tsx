import { createFileRoute } from "@tanstack/react-router";

import { InquiryDetailRoute } from "#pages/inquiries/index.ts";

const Route = createFileRoute("/_admin/inquiries/$id")({
  component: InquiryDetailRoute,
});

export { Route };
