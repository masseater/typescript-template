import { useAtomValue } from "@effect/atom-react";
import { firstResultError, resultValue } from "@repo/ui";

import { useInquiryList, useInquiryStatusFilter } from "#pages/inquiries/model/inquiry-list.ts";
import { pendingCountAtom } from "#shared/api/index.ts";
import { InquiriesView } from "./inquiries-view.tsx";

import type { ReactElement } from "react";

function InquiriesPage(): ReactElement {
  const { status, toggle } = useInquiryStatusFilter();
  const listing = useInquiryList(status);
  const pendingState = useAtomValue(pendingCountAtom);
  return (
    <InquiriesView
      error={firstResultError(listing, pendingState)}
      inquiries={resultValue(listing)}
      onToggle={toggle}
      pendingCount={resultValue(pendingState)}
      status={status}
    />
  );
}

export { InquiriesPage };
