import { firstResultError, resultValue } from "@repo/ui";

import { useInquiryList } from "#pages/inquiries/model/inquiry-list.ts";
import { useInquiryThread } from "#pages/inquiries/model/inquiry-thread.ts";
import { InquiryDetailView } from "./inquiry-detail-view.tsx";
import { InquiryMemberSummary } from "./inquiry-member-summary.tsx";
import { InquiryReplyForm } from "./inquiry-reply-form.tsx";

import type { ReactElement } from "react";

const memberSummaryOf = (memberId: string): ReactElement => (
  <InquiryMemberSummary memberId={memberId} />
);

function InquiryDetailPage({ inquiryId }: Readonly<{ inquiryId: string }>): ReactElement {
  const listing = useInquiryList();
  const { reload, thread } = useInquiryThread(inquiryId);
  return (
    <InquiryDetailView
      error={firstResultError(thread, listing)}
      inquiries={resultValue(listing)}
      inquiry={resultValue(thread)}
      memberSummary={memberSummaryOf}
      replyForm={<InquiryReplyForm inquiryId={inquiryId} onChanged={reload} />}
    />
  );
}

export { InquiryDetailPage };
