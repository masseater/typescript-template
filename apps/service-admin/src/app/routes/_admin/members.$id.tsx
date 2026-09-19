import { createFileRoute } from "@tanstack/react-router";

import { MemberDetailPage } from "#pages/member-detail/index.ts";

import type { ReactElement } from "react";

const Route = createFileRoute("/_admin/members/$id")({
  component: MemberDetailRoute,
});

function MemberDetailRoute(): ReactElement {
  const { id } = Route.useParams();
  return <MemberDetailPage memberId={id} />;
}

export { Route };
