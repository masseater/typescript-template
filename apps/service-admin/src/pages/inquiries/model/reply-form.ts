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
    action.run(() =>
      replyToInquiry({ body, id: inquiryId }).then(() => {
        setBody("");
        onChanged();
      }),
    );
  }
  function handleClose(): void {
    action.run(() =>
      closeInquiry(inquiryId).then(() => {
        onChanged();
      }),
    );
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
