import { createFileRoute } from "@tanstack/react-router";

import { InquiryDetailPage } from "#pages/inquiries/index.ts";

const Route = createFileRoute("/_admin/inquiries/$id")({
  component: InquiryDetailRoute,
});

function InquiryDetailRoute(): React.ReactElement {
  const { id } = Route.useParams();
  return <InquiryDetailPage inquiryId={id} />;
}

export { Route };
