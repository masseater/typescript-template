import { useInquiryLookup } from "#pages/inquiries/model/inquiry-lookup.ts";
import { InquiriesView } from "./inquiries-view.tsx";

import type { ReactElement } from "react";

function InquiriesPage(): ReactElement {
  const lookup = useInquiryLookup();
  return <InquiriesView lookup={lookup} />;
}

export { InquiriesPage };
