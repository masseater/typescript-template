import { getRouteApi } from "@tanstack/react-router";

import { SupportDetailPage } from "./support-detail-page.tsx";

import type { ReactElement } from "react";

const route = getRouteApi("/_member/support/$id");

function SupportDetailRoute(): ReactElement {
  const { id } = route.useParams();
  return <SupportDetailPage inquiryId={id} />;
}

export { SupportDetailRoute };
