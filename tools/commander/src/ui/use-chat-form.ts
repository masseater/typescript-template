import { useState } from "react";

import { usePost } from "./use-post.ts";

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
  const message = usePost("/api/chat");
  const stop = usePost("/api/chat/stop");

  async function submit(): Promise<void> {
    const body = text.trim();
    if (body !== "" && (await message.send({ text: body }))) {
      setText("");
    }
  }

  return {
    failed: message.failed || stop.failed,
    handleSend: () => {
      void submit();
    },
    handleStop: () => {
      void stop.send({});
    },
    handleSubmit: (event) => {
      event.preventDefault();
      void submit();
    },
    handleText: setText,
    sendable: !message.pending && text.trim() !== "",
    stoppable: !stop.pending,
    text,
  };
}

export { useChatForm };
