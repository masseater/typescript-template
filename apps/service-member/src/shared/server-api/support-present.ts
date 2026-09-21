import { ROLE } from "@repo/config";
import { INQUIRY_STATUS } from "@repo/config/inquiry";

import type { getMemberInquiry, listMemberInquiries } from "@repo/db";
import type { Effect } from "effect";

const inquiryStatusLabels: Readonly<Record<"answered" | "closed" | "open", string>> = {
  [INQUIRY_STATUS.answered]: "対応中",
  [INQUIRY_STATUS.closed]: "完了",
  [INQUIRY_STATUS.open]: "受付",
};

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
    closed: thread.status === INQUIRY_STATUS.closed,
    messages: thread.messages.map((message) => ({
      authorId: message.authorId,
      body: message.body,
      createdAt: message.createdAt,
      fromOperator: message.authorKind === ROLE.administrator,
      id: message.id,
    })),
  };
}

export { presentSummary, presentThread };
