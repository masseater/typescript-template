import { useAction, localState } from "@repo/ui";
import { Effect } from "effect";

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

function postReply(
  threadId: string,
  body: string,
  setBody: (value: string) => void,
  onPosted: () => Promise<void>,
): Promise<void> {
  return Effect.runPromise(
    Effect.gen(function* publishReply() {
      yield* Effect.promise(() => replyToThread(threadId, body));
      setBody("");
      yield* Effect.promise(() => onPosted());
    }),
  );
}

function useReplyForm(threadId: string, onPosted: () => Promise<void>): ReplyForm {
  const [body, setBody] = useBody();
  const action = useAction();
  function handleSubmit(event: Readonly<{ preventDefault: () => void }>): void {
    event.preventDefault();
    action.run(() => postReply(threadId, body, setBody, onPosted));
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
