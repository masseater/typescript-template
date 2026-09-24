import type {
  AdminInquiryList,
  AdminInquiryThread,
  InquiryMemberSummary,
} from "#shared/contracts/index.ts";

type AdminInquirySummary = (typeof AdminInquiryList.Type)["inquiries"][number];
type AdminInquiryDetail = typeof AdminInquiryThread.Type;

export type { AdminInquiryDetail, AdminInquirySummary, InquiryMemberSummary };
