import { INQUIRY_STATUS } from "@repo/config";
import { IdentifierQuery, InquiryMessage } from "@repo/runtime/contracts";
import { Schema } from "effect";

const InquiryStatus = Schema.String;

const InquiryStatusCount = Schema.Struct({
  [INQUIRY_STATUS.answered]: Schema.Finite,
  [INQUIRY_STATUS.closed]: Schema.Finite,
  [INQUIRY_STATUS.open]: Schema.Finite,
});

const InquiryDailyTrend = Schema.Struct({ ...InquiryStatusCount.fields, day: Schema.String });

const StaffInquiryCounts = Schema.Struct({
  byStatus: InquiryStatusCount,
  trend: Schema.Array(InquiryDailyTrend),
});

const StaffInquirySummary = Schema.Struct({
  createdAt: Schema.DateFromString,
  id: Schema.String,
  memberId: Schema.String,
  status: InquiryStatus,
  subject: Schema.String,
  updatedAt: Schema.DateFromString,
});

const StaffInquiryThread = Schema.Struct({
  ...StaffInquirySummary.fields,
  messages: Schema.Array(InquiryMessage),
});

const StaffInquiryList = Schema.Struct({ inquiries: Schema.Array(StaffInquirySummary) });

const InquiryQuery = IdentifierQuery;

const MemberQuery = IdentifierQuery;

type StaffInquiryCountsView = typeof StaffInquiryCounts.Type;
type StaffInquiryThreadView = typeof StaffInquiryThread.Type;

export { InquiryQuery, MemberQuery, StaffInquiryCounts, StaffInquiryList, StaffInquiryThread };
export type { StaffInquiryCountsView, StaffInquiryThreadView };
