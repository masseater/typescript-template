import { roles } from "@repo/config";
import { Schema } from "effect";

const maximumIdentifierLength = 256;

const Identifier = Schema.String.check(Schema.isLengthBetween(1, maximumIdentifierLength));

const InquiryStatus = Schema.String;

const InquiryStatusCount = Schema.Struct({
  answered: Schema.Finite,
  closed: Schema.Finite,
  open: Schema.Finite,
});

const InquiryDailyTrend = Schema.Struct({
  answered: Schema.Finite,
  closed: Schema.Finite,
  day: Schema.String,
  open: Schema.Finite,
});

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

const StaffInquiryMessage = Schema.Struct({
  authorId: Schema.String,
  authorKind: Schema.Literals(roles),
  body: Schema.String,
  createdAt: Schema.DateFromString,
  id: Schema.String,
});

const StaffInquiryThread = Schema.Struct({
  ...StaffInquirySummary.fields,
  messages: Schema.Array(StaffInquiryMessage),
});

const StaffInquiryList = Schema.Struct({ inquiries: Schema.Array(StaffInquirySummary) });

const InquiryQuery = Schema.Struct({ id: Identifier });

const MemberQuery = Schema.Struct({ id: Identifier });

type StaffInquiryCountsView = typeof StaffInquiryCounts.Type;
type StaffInquiryThreadView = typeof StaffInquiryThread.Type;

export { InquiryQuery, MemberQuery, StaffInquiryCounts, StaffInquiryList, StaffInquiryThread };
export type { StaffInquiryCountsView, StaffInquiryThreadView };
