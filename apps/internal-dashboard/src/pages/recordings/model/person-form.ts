import { localState, useAction, useTextInput } from "@repo/ui";
import { Effect } from "effect";

import { registerPerson } from "#pages/recordings/api/recordings.ts";

import type { SubmitEventHandler } from "react";

const useConsent = localState(false);

function register(
  name: string,
  consented: boolean,
  onRegistered: () => Promise<void>,
): Promise<void> {
  return Effect.runPromise(
    Effect.gen(function* registerSpeaker() {
      if (!consented) {
        return yield* Effect.die(new Error("本人の同意を確認してください。"));
      }
      yield* Effect.promise(() => registerPerson(name));
      yield* Effect.promise(() => onRegistered());
    }),
  );
}

interface PersonForm {
  readonly blocked: boolean;
  readonly consented: boolean;
  readonly error: string | undefined;
  readonly handleConsentChange: (consented: boolean) => void;
  readonly handleNameChange: (value: string) => void;
  readonly handleSubmit: SubmitEventHandler<HTMLFormElement>;
  readonly name: string;
  readonly pending: boolean;
}

function usePersonForm(onRegistered: () => Promise<void>): PersonForm {
  const name = useTextInput();
  const [consented, setConsented] = useConsent();
  const action = useAction();
  function handleSubmit(event: Readonly<{ preventDefault: () => void }>): void {
    event.preventDefault();
    action.run(() =>
      register(name.value, consented, () =>
        onRegistered().then(() => {
          name.handleChange("");
          setConsented(false);
        }),
      ),
    );
  }
  return {
    blocked: action.blocked,
    consented,
    error: action.error,
    handleConsentChange: setConsented,
    handleNameChange: name.handleChange,
    handleSubmit,
    name: name.value,
    pending: action.pending,
  };
}

export { usePersonForm };
