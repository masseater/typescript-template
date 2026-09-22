import { getRouteApi } from "@tanstack/react-router";

import { InquiryDetailPage } from "./inquiry-detail-page.tsx";

import type { ReactElement } from "react";

const route = getRouteApi("/_admin/inquiries/$id");

function InquiryDetailRoute(): ReactElement {
  const { id } = route.useParams();
  return <InquiryDetailPage inquiryId={id} />;
}

export { InquiryDetailRoute };
