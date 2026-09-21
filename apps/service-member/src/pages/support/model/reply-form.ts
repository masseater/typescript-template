import { localState, useAction } from "@repo/ui";

import { replyToInquiry } from "#pages/support/api/support.ts";

import type { SubmitEventHandler } from "react";

interface ReplyForm {
  readonly blocked: boolean;
  readonly body: string;
  readonly error: string | undefined;
  readonly handleBodyChange: (value: string) => void;
  readonly handleSubmit: SubmitEventHandler<HTMLFormElement>;
}

const useBody = localState("");

function useReplyForm(inquiryId: string, onReplied: () => void): ReplyForm {
  const [body, setBody] = useBody();
  const action = useAction();
  function handleSubmit(event: Readonly<{ preventDefault: () => void }>): void {
    event.preventDefault();
    action.run(async () => {
      await replyToInquiry({ body, id: inquiryId });
      setBody("");
      onReplied();
    });
  }
  return {
    blocked: action.blocked,
    body,
    error: action.error,
    handleBodyChange: setBody,
    handleSubmit,
  };
}

export { useReplyForm };
