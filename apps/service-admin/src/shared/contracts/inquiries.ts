import { roles } from "@repo/config";
import { inquiryStatuses } from "@repo/db/inquiry-status";
import { Effect, Schema } from "effect";

const maximumIdentifierLength = 256;
const maximumBodyLength = 4000;
const defaultPageSize = 50;
const maximumPageSize = 100;

const Identifier = Schema.String.check(Schema.isLengthBetween(1, maximumIdentifierLength));

const InquiryStatus = Schema.Literals(inquiryStatuses);

function pageNumber(
  fallback: number,
  minimum: number,
  maximum: number,
): Schema.withDecodingDefaultKey<Schema.NumberFromString> {
  const range = Schema.isBetween({ maximum, minimum });
  const bounded = Schema.NumberFromString.check(Schema.isInt(), range);
  const fallbackText = Effect.succeed(String(fallback));
  return bounded.pipe(Schema.withDecodingDefaultKey(fallbackText));
}

const InquiryListQuery = Schema.Struct({
  limit: pageNumber(defaultPageSize, 1, maximumPageSize),
  offset: pageNumber(0, 0, Number.MAX_SAFE_INTEGER),
  status: Schema.optionalKey(InquiryStatus),
});

const InquiryMessage = Schema.Struct({
  authorId: Schema.String,
  authorKind: Schema.Literals(roles),
  body: Schema.String,
  createdAt: Schema.DateFromString,
  id: Schema.String,
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
});

const AdminInquiryList = Schema.Struct({
  inquiries: Schema.Array(AdminInquirySummary),
  total: Schema.Finite,
});

const InquiryQuery = Schema.Struct({ id: Identifier });

const MemberQuery = Schema.Struct({ id: Identifier });

const InquiryMemberSummary = Schema.Struct({
  email: Schema.String,
  id: Schema.String,
  name: Schema.String,
});

const InquiryReply = Schema.Struct({
  body: Schema.Trim.check(Schema.isLengthBetween(1, maximumBodyLength)),
  id: Identifier,
});

const InquiryClose = Schema.Struct({ id: Identifier });

const PendingCount = Schema.Struct({ count: Schema.Finite });

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
  maximumBodyLength,
};
