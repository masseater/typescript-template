import { ROLE, inquiryStatusLabels } from "@repo/config";

import type { getMemberInquiry, listMemberInquiries } from "@repo/db";
import type { Effect } from "effect";

type ListedInquiry = Effect.Success<ReturnType<typeof listMemberInquiries>>[number];
type InquiryThread = Effect.Success<ReturnType<typeof getMemberInquiry>>;

function presentSummary(inquiry: ListedInquiry) {
  return {
    createdAt: inquiry.createdAt,
    id: inquiry.id,
    status: inquiry.status,
    statusLabel: inquiryStatusLabels[inquiry.status],
    subject: inquiry.subject,
    updatedAt: inquiry.updatedAt,
  };
}

function presentThread(thread: InquiryThread) {
  return {
    ...presentSummary(thread),
    messages: thread.messages.map((message) => ({
      authorId: message.authorId,
      body: message.body,
      createdAt: message.createdAt,
      fromOperator: message.authorKind === ROLE.administrator,
      id: message.id,
    })),
    replyable: thread.replyable,
  };
}

export { presentSummary, presentThread };
export type { InquiryThread, ListedInquiry };
