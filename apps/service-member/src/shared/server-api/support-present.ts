import { ROLE } from "@repo/config";
import { INQUIRY_STATUS } from "@repo/db/inquiry-status";

import type { getMemberInquiry, listMemberInquiries } from "@repo/db";

const inquiryStatusLabels: Readonly<Record<"answered" | "closed" | "open", string>> = {
  [INQUIRY_STATUS.answered]: "対応中",
  [INQUIRY_STATUS.closed]: "完了",
  [INQUIRY_STATUS.open]: "受付",
};

function presentSummary(inquiry: Awaited<ReturnType<typeof listMemberInquiries>>[number]) {
  return {
    createdAt: inquiry.createdAt,
    id: inquiry.id,
    status: inquiry.status,
    statusLabel: inquiryStatusLabels[inquiry.status],
    subject: inquiry.subject,
    updatedAt: inquiry.updatedAt,
  };
}

function presentThread(thread: Awaited<ReturnType<typeof getMemberInquiry>>) {
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
