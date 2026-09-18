import { usePost } from "./use-post.ts";
import { useState } from "react";

type KeyPress = Readonly<{
  key: string;
  nativeEvent: Readonly<{ isComposing: boolean }>;
  preventDefault: () => void;
  shiftKey: boolean;
}>;

interface ChatFormState {
  readonly failed: boolean;
  readonly handleChange: (event: Readonly<{ target: Readonly<{ value: string }> }>) => void;
  readonly handleKeyDown: (event: KeyPress) => void;
  readonly handleStop: () => void;
  readonly handleSubmit: (event: Readonly<{ preventDefault: () => void }>) => void;
  readonly sendable: boolean;
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
    handleChange: (event) => {
      setText(event.target.value);
    },
    handleKeyDown: (event) => {
      if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
        event.preventDefault();
        void submit();
      }
    },
    handleStop: () => {
      void stop.send({});
    },
    handleSubmit: (event) => {
      event.preventDefault();
      void submit();
    },
    sendable: !message.pending && text.trim() !== "",
    stoppable: !stop.pending,
    text,
  };
}

export { useChatForm };
