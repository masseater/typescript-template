import { useAction, useTextInput } from "@repo/ui";

import { openConversation } from "#pages/messages/api/messages.ts";

interface ComposeForm {
  readonly blocked: boolean;
  readonly body: string;
  readonly error: string | undefined;
  readonly handleBodyChange: (value: string) => void;
  readonly handleSubmit: (event: Readonly<{ preventDefault: () => void }>) => void;
  readonly pending: boolean;
}

function useComposeForm(
  peerId: string,
  onOpened: (conversationId: string) => Promise<void>,
  onPaidRequired: () => Promise<void>,
): ComposeForm {
  const body = useTextInput();
  const action = useAction();
  function handleSubmit(event: Readonly<{ preventDefault: () => void }>): void {
    event.preventDefault();
    action.run(() =>
      openConversation(peerId, body.value).then((opened) => {
        if (opened.paidRequired) {
          return onPaidRequired();
        }
        body.handleChange("");
        return onOpened(opened.conversationId);
      }),
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

export { useComposeForm };
