import { useAction, useTextInput } from "@repo/ui";
import { Effect } from "effect";

import { openThread } from "#pages/board/api/board.ts";

import type { SubmitEventHandler } from "react";

function createThread(
  title: string,
  body: string,
  onCreated: (threadId: string) => Promise<void>,
): Promise<void> {
  return Effect.runPromise(
    Effect.gen(function* publishThread() {
      const threadId = yield* Effect.promise(() => openThread(title, body));
      yield* Effect.promise(() => onCreated(threadId));
    }),
  );
}

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
    action.run(() => createThread(title.value, body.value, onCreated));
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
