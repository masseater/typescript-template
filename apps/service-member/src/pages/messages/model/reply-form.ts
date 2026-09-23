import { useAction, useTextInput } from "@repo/ui";

import { sendMessage } from "#pages/messages/api/messages.ts";

import type { ReplyBodyFormState } from "#shared/ui/index.ts";
function useReplyForm(conversationId: string, onSent: () => Promise<void>): ReplyBodyFormState {
  const body = useTextInput();
  const action = useAction();
  function handleSubmit(
    event: Readonly<{
      preventDefault: () => void;
    }>,
  ): void {
    event.preventDefault();
    action.run(() =>
      sendMessage(conversationId, body.value).then(() =>
        Promise.resolve().then(() => {
          body.handleChange("");
          return onSent().then(() => undefined);
        }),
      ),
    );
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
