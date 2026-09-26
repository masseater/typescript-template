import { InquiryStatus } from "@repo/config";
import {
  Identifier,
  IdentifierQuery,
  InquiryMessage,
  Tally,
  pageNumber,
} from "@repo/runtime/contracts";
import { Schema } from "effect";

const maximumReplyLength = 4000;
const defaultPageSize = 50;
const maximumPageSize = 100;

const InquiryListQuery = Schema.Struct({
  limit: pageNumber({ fallback: defaultPageSize, maximum: maximumPageSize, minimum: 1 }),
  offset: pageNumber({ fallback: 0, maximum: Number.MAX_SAFE_INTEGER, minimum: 0 }),
  status: Schema.optionalKey(InquiryStatus),
});

const AdminInquirySummary = Schema.Struct({
  createdAt: Schema.DateFromString,
  id: Schema.String,
  memberId: Schema.String,
  memberName: Schema.String,
  status: InquiryStatus,
  subject: Schema.String,
  updatedAt: Schema.DateFromString,
});

const AdminInquiryThread = Schema.Struct({
  ...AdminInquirySummary.fields,
  messages: Schema.Array(InquiryMessage),
  replyable: Schema.Boolean,
});

const AdminInquiryList = Schema.Struct({
  inquiries: Schema.Array(AdminInquirySummary),
  total: Schema.Finite,
});

const InquiryQuery = IdentifierQuery;

const MemberQuery = IdentifierQuery;

const InquiryMemberSummary = Schema.Struct({
  email: Schema.String,
  id: Schema.String,
  name: Schema.String,
});

const InquiryReply = Schema.Struct({
  body: Schema.Trim.check(Schema.isLengthBetween(1, maximumReplyLength)),
  id: Identifier,
});

const InquiryClose = IdentifierQuery;

const PendingCount = Tally;

export {
  AdminInquiryList,
  AdminInquiryThread,
  InquiryClose,
  InquiryListQuery,
  InquiryMemberSummary,
  InquiryQuery,
  InquiryReply,
  MemberQuery,
  PendingCount,
  maximumReplyLength,
};
