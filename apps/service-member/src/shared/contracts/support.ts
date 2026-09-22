import { Schema } from "effect";

import { maximumBodyLength, maximumSubjectLength } from "./support-limits.ts";

const maximumIdentifierLength = 256;

const Identifier = Schema.String.check(Schema.isLengthBetween(1, maximumIdentifierLength));

const InquiryStatus = Schema.String;

const InquiryMessage = Schema.Struct({
  authorId: Schema.String,
  body: Schema.String,
  createdAt: Schema.DateFromString,
  fromOperator: Schema.Boolean,
  id: Schema.String,
});

const InquirySummary = Schema.Struct({
  createdAt: Schema.DateFromString,
  id: Schema.String,
  status: InquiryStatus,
  statusLabel: Schema.String,
  subject: Schema.String,
  updatedAt: Schema.DateFromString,
});

const InquiryThread = Schema.Struct({
  ...InquirySummary.fields,
  closed: Schema.Boolean,
  messages: Schema.Array(InquiryMessage),
});

const InquiryList = Schema.Struct({ inquiries: Schema.Array(InquirySummary) });

const InquiryQuery = Schema.Struct({ id: Identifier });

const InquiryCreate = Schema.Struct({
  body: Schema.Trim.check(Schema.isLengthBetween(1, maximumBodyLength)),
  subject: Schema.Trim.check(Schema.isLengthBetween(1, maximumSubjectLength)),
});

const InquiryReply = Schema.Struct({
  body: Schema.Trim.check(Schema.isLengthBetween(1, maximumBodyLength)),
  id: Identifier,
});

type InquirySummary = (typeof InquiryList.Type)["inquiries"][number];
type InquiryDetail = typeof InquiryThread.Type;

export { InquiryCreate, InquiryList, InquiryQuery, InquiryReply, InquiryThread };
export type { InquiryDetail, InquirySummary };
