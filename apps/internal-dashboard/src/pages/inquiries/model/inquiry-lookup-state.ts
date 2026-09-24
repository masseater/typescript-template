import type {
  StaffInquiryCountsView,
  StaffInquiryList,
  StaffInquiryThreadView,
} from "#shared/contracts/index.ts";
import type { SubmitEventHandler } from "react";

type StaffInquirySummary = (typeof StaffInquiryList.Type)["inquiries"][number];

interface InquiryLookup {
  readonly counts: StaffInquiryCountsView | undefined;
  readonly error: string | undefined;
  readonly handleInquiryLookup: SubmitEventHandler<HTMLFormElement>;
  readonly handleLookupIdChange: (value: string) => void;
  readonly handleMemberIdChange: (value: string) => void;
  readonly handleMemberLookup: SubmitEventHandler<HTMLFormElement>;
  readonly lookupId: string;
  readonly memberId: string;
  readonly memberInquiries: readonly StaffInquirySummary[] | undefined;
  readonly selected: StaffInquiryThreadView | undefined;
  readonly showInquiry: (inquiryId: string) => void;
}

export type { InquiryLookup, StaffInquirySummary };
