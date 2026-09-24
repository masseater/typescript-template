import { useTextSubmission } from "@repo/ui";

import { sendMessage } from "#pages/messages/api/messages.ts";

import type { TextSubmission } from "@repo/ui";

function useReplyForm(conversationId: string, onSent: () => Promise<void>): TextSubmission {
  return useTextSubmission((body) => sendMessage(conversationId, body), onSent);
}

export { useReplyForm };
