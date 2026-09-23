import { useTextSubmission } from "@repo/ui";

import { replyToInquiry } from "#pages/support/api/support.ts";

import type { TextSubmission } from "@repo/ui";

function useReplyForm(inquiryId: string, onReplied: () => void): TextSubmission {
  return useTextSubmission((body) => replyToInquiry({ body, id: inquiryId }), onReplied);
}

export { useReplyForm };
