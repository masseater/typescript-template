import { resultError, resultValue } from "@repo/ui";

import { useMemberSummary } from "#pages/inquiries/model/inquiry-thread.ts";
import { MemberSummaryView } from "./inquiry-detail-view.tsx";

import type { ReactElement } from "react";

function InquiryMemberSummary({ memberId }: Readonly<{ memberId: string }>): ReactElement {
  const summary = useMemberSummary(memberId);
  return <MemberSummaryView failure={resultError(summary)} summary={resultValue(summary)} />;
}

export { InquiryMemberSummary };
