import { useTextSubmission } from "@repo/ui";

import { closeInquiry, replyToInquiry } from "#pages/inquiries/api/inquiries.ts";

import type { SubmitEventHandler } from "react";

interface ReplyForm {
  readonly blocked: boolean;
  readonly body: string;
  readonly error: string | undefined;
  readonly handleBodyChange: (value: string) => void;
  readonly handleClose: () => void;
  readonly handleSubmit: SubmitEventHandler<HTMLFormElement>;
}

function useReplyForm(inquiryId: string, onChanged: () => void): ReplyForm {
  const reply = useTextSubmission((body) => replyToInquiry({ body, id: inquiryId }), onChanged);
  function handleClose(): void {
    reply.action.run(() =>
      closeInquiry(inquiryId).then(() => {
        onChanged();
      }),
    );
  }
  return {
    blocked: reply.action.blocked,
    body: reply.text,
    error: reply.action.error,
    handleBodyChange: reply.handleTextChange,
    handleClose,
    handleSubmit: reply.handleSubmit,
  };
}

export { useReplyForm };
