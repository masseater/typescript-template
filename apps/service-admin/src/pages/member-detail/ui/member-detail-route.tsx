import { getRouteApi } from "@tanstack/react-router";

import { MemberDetailPage } from "./member-detail-page.tsx";

import type { ReactElement } from "react";

const route = getRouteApi("/_admin/members/$id");

function MemberDetailRoute(): ReactElement {
  const { id } = route.useParams();
  return <MemberDetailPage memberId={id} />;
}

export { MemberDetailRoute };
