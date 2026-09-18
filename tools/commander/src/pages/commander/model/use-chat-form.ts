import { useState } from "react";

import { useSay, useStop } from "./actions.ts";

interface ChatFormState {
  readonly failed: boolean;
  readonly handleSend: () => void;
  readonly handleStop: () => void;
  readonly handleSubmit: (event: Readonly<{ preventDefault: () => void }>) => void;
  readonly sendable: boolean;
  readonly handleText: (text: string) => void;
  readonly stoppable: boolean;
  readonly text: string;
}

function useChatForm(): ChatFormState {
  const [text, setText] = useState("");
  const say = useSay();
  const stop = useStop();

  function submit(): void {
    const body = text.trim();
    if (body !== "") {
      say.mutate(body, {
        onSuccess: () => {
          setText("");
        },
      });
    }
  }

  return {
    failed: say.isError || stop.isError,
    handleSend: submit,
    handleStop: () => {
      stop.mutate();
    },
    handleSubmit: (event) => {
      event.preventDefault();
      submit();
    },
    handleText: setText,
    sendable: !say.isPending && text.trim() !== "",
    stoppable: !stop.isPending,
    text,
  };
}

export { useChatForm };
