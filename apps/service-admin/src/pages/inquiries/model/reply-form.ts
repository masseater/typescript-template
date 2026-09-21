import { localState, useAction } from "@repo/ui";

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

const useBody = localState("");

function useReplyForm(inquiryId: string, onChanged: () => void): ReplyForm {
  const [body, setBody] = useBody();
  const action = useAction();
  function handleSubmit(event: Readonly<{ preventDefault: () => void }>): void {
    event.preventDefault();
    action.run(async () => {
      await replyToInquiry({ body, id: inquiryId });
      setBody("");
      onChanged();
    });
  }
  function handleClose(): void {
    action.run(async () => {
      await closeInquiry(inquiryId);
      onChanged();
    });
  }
  return {
    blocked: action.blocked,
    body,
    error: action.error,
    handleBodyChange: setBody,
    handleClose,
    handleSubmit,
  };
}

export { useReplyForm };
