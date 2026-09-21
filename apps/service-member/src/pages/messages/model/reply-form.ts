import { useAction, useTextInput } from "@repo/ui";

import { sendMessage } from "#pages/messages/api/messages.ts";

interface ReplyForm {
  readonly blocked: boolean;
  readonly body: string;
  readonly error: string | undefined;
  readonly handleBodyChange: (value: string) => void;
  readonly handleSubmit: (event: Readonly<{ preventDefault: () => void }>) => void;
  readonly pending: boolean;
}

function useReplyForm(conversationId: string, onSent: () => Promise<void>): ReplyForm {
  const body = useTextInput();
  const action = useAction();
  function handleSubmit(event: Readonly<{ preventDefault: () => void }>): void {
    event.preventDefault();
    action.run(async () => {
      await sendMessage(conversationId, body.value);
      body.handleChange("");
      await onSent();
    });
  }
  return {
    blocked: action.blocked,
    body: body.value,
    error: action.error,
    handleBodyChange: body.handleChange,
    handleSubmit,
    pending: action.pending,
  };
}

export { useReplyForm };
