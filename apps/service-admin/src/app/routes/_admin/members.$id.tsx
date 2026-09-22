import { createFileRoute } from "@tanstack/react-router";

import { MemberDetailRoute } from "#pages/member-detail/index.ts";

const Route = createFileRoute("/_admin/members/$id")({
  component: MemberDetailRoute,
});

export { Route };
