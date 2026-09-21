import { createFileRoute } from "@tanstack/react-router";

import { SupportDetailPage } from "#pages/support/index.ts";

const Route = createFileRoute("/_member/support/$id")({
  component: SupportDetailRoute,
});

function SupportDetailRoute(): React.ReactElement {
  const { id } = Route.useParams();
  return <SupportDetailPage inquiryId={id} />;
}

export { Route };
