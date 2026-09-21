import { useAction, useTextInput } from "@repo/ui";
import { useNavigate } from "@tanstack/react-router";

import { PaidPlanRequired, openConversation } from "#pages/messages/api/messages.ts";

interface ComposeForm {
  readonly blocked: boolean;
  readonly body: string;
  readonly error: string | undefined;
  readonly handleBodyChange: (value: string) => void;
  readonly handleSubmit: (event: Readonly<{ preventDefault: () => void }>) => void;
  readonly pending: boolean;
}

function useComposeForm(recipientId: string): ComposeForm {
  const body = useTextInput();
  const navigate = useNavigate();
  const action = useAction();
  function handleSubmit(event: Readonly<{ preventDefault: () => void }>): void {
    event.preventDefault();
    action.run(async () => {
      try {
        const conversationId = await openConversation(recipientId, body.value);
        await navigate({ params: { id: conversationId }, replace: true, to: "/messages/$id" });
      } catch (failure) {
        if (failure instanceof PaidPlanRequired) {
          await navigate({ replace: true, to: "/upgrade" });
          return;
        }
        throw failure;
      }
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

export { useComposeForm };
