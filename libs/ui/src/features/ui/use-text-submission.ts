import { Effect } from "effect";

import { useAction } from "./action";
import { useTextInput, type TextInput } from "./use-text-input";

import type { SubmitEventHandler } from "react";

type TextSubmission = Readonly<{
  blocked: boolean;
  body: string;
  error: string | undefined;
  handleBodyChange: (value: string) => void;
  handleSubmit: SubmitEventHandler<HTMLFormElement>;
  pending: boolean;
}>;

const submittedDraft = (
  draft: TextInput,
  delivery: Readonly<{
    onSent: () => Promise<void> | void;
    send: (text: string) => Promise<unknown>;
  }>,
): Effect.Effect<void> =>
  Effect.gen(function* submittedDraft() {
    yield* Effect.promise(() => delivery.send(draft.value));
    draft.handleChange("");
    yield* Effect.promise(() => Promise.resolve(delivery.onSent()));
  });

const useTextSubmission = (
  send: (text: string) => Promise<unknown>,
  onSent: () => Promise<void> | void,
): TextSubmission => {
  const draft = useTextInput();
  const action = useAction();
  const submitDraft = (): Promise<void> =>
    Effect.runPromise(submittedDraft(draft, { onSent, send }));
  const handleSubmit = (submission: Readonly<{ preventDefault: () => void }>): void => {
    submission.preventDefault();
    action.run(submitDraft);
  };
  return {
    blocked: action.blocked,
    body: draft.value,
    error: action.error,
    handleBodyChange: draft.handleChange,
    handleSubmit,
    pending: action.pending,
  };
};

export { useTextSubmission };
export type { TextSubmission };
