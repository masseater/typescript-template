import { useTextSubmission } from "@repo/ui";

import { replyToThread } from "#pages/board/api/board.ts";

import type { TextSubmission } from "@repo/ui";

function useReplyForm(threadId: string, onPosted: () => Promise<void>): TextSubmission {
  return useTextSubmission((body) => replyToThread(threadId, body), onPosted);
}

export { useReplyForm };
