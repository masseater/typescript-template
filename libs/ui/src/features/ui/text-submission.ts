import { Effect } from "effect";

import { useAction, type ActionState } from "./action";
import { useTextInput, type TextInput } from "./use-text-input";

const submitText = ({
  draft,
  onSent,
  send,
}: Readonly<{
  draft: TextInput;
  onSent: () => void;
  send: (entered: string) => Promise<unknown>;
}>): Effect.Effect<void> =>
  Effect.gen(function* submitDraft() {
    yield* Effect.promise(() => send(draft.value));
    draft.handleChange("");
    onSent();
  });

const useTextSubmission = (
  send: (entered: string) => Promise<unknown>,
  onSent: () => void,
): Readonly<{
  action: ActionState;
  handleSubmit: (submitEvent: Readonly<{ preventDefault: () => void }>) => void;
  handleTextChange: (entered: string) => void;
  text: string;
}> => {
  const draft = useTextInput();
  const action = useAction();
  const handleSubmit = (submitEvent: Readonly<{ preventDefault: () => void }>): void => {
    submitEvent.preventDefault();
    action.run(() => Effect.runPromise(submitText({ draft, onSent, send })));
  };
  return { action, handleSubmit, handleTextChange: draft.handleChange, text: draft.value };
};

export { useTextSubmission };
