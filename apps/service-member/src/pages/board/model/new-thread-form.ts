import { useAction, useTextInput } from "@repo/ui";
import { Effect } from "effect";

import { openThread } from "#pages/board/api/board.ts";

import type { SubmitEventHandler } from "react";

interface NewThreadForm {
  readonly blocked: boolean;
  readonly body: string;
  readonly error: string | undefined;
  readonly handleBodyChange: (value: string) => void;
  readonly handleSubmit: SubmitEventHandler<HTMLFormElement>;
  readonly handleTitleChange: (value: string) => void;
  readonly pending: boolean;
  readonly title: string;
}

function useNewThreadForm(onCreated: (threadId: string) => Promise<void>): NewThreadForm {
  const title = useTextInput();
  const body = useTextInput();
  const action = useAction();
  function handleSubmit(event: Readonly<{ preventDefault: () => void }>): void {
    event.preventDefault();
    action.run(() =>
      Effect.runPromise(
        Effect.gen(function* createThread() {
          const threadId = yield* Effect.promise(() => openThread(title.value, body.value));
          yield* Effect.promise(() => onCreated(threadId));
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
    handleTitleChange: title.handleChange,
    pending: action.pending,
    title: title.value,
  };
}

export { useNewThreadForm };
