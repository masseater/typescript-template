import { useAction, localState } from "@repo/ui";

import { replyToThread } from "#pages/board/api/board.ts";

import type { SubmitEventHandler } from "react";

interface ReplyForm {
  readonly blocked: boolean;
  readonly body: string;
  readonly error: string | undefined;
  readonly handleBodyChange: (value: string) => void;
  readonly handleSubmit: SubmitEventHandler<HTMLFormElement>;
  readonly pending: boolean;
}

const useBody = localState("");

function useReplyForm(threadId: string, onPosted: () => Promise<void>): ReplyForm {
  const [body, setBody] = useBody();
  const action = useAction();
  function handleSubmit(event: Readonly<{ preventDefault: () => void }>): void {
    event.preventDefault();
    action.run(async () => {
      await replyToThread(threadId, body);
      setBody("");
      await onPosted();
    });
  }
  return {
    blocked: action.blocked,
    body,
    error: action.error,
    handleBodyChange: setBody,
    handleSubmit,
    pending: action.pending,
  };
}

export { useReplyForm };
