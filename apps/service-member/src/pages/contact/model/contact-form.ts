import { useAction, localState } from "@repo/ui";
import { Effect } from "effect";

import { submitContact } from "#pages/contact/api/submit-contact.ts";

import type { SubmitEventHandler } from "react";

interface ContactFields {
  readonly email: string;
  readonly message: string;
  readonly name: string;
}

interface ContactFormState extends ContactFields {
  readonly blocked: boolean;
  readonly error: string;
  readonly handleEmailChange: (value: string) => void;
  readonly handleMessageChange: (value: string) => void;
  readonly handleNameChange: (value: string) => void;
  readonly handleSubmit: SubmitEventHandler<HTMLFormElement>;
  readonly pending: boolean;
}

const useFields = localState<ContactFields>({ email: "", message: "", name: "" });

function sendContact(fields: ContactFields, onSent: () => void): Promise<void> {
  return Effect.runPromise(
    Effect.gen(function* submit() {
      yield* Effect.promise(() => submitContact(fields));
      onSent();
    }),
  );
}

function useContactForm(onSent: () => void): ContactFormState {
  const [fields, setFields] = useFields();
  const action = useAction();
  function handleSubmit(event: Readonly<{ preventDefault: () => void }>): void {
    event.preventDefault();
    action.run(() => sendContact(fields, onSent));
  }
  return {
    ...fields,
    blocked: action.blocked,
    error: action.error ?? "",
    handleEmailChange: (email) => {
      setFields((current) => ({ ...current, email }));
    },
    handleMessageChange: (message) => {
      setFields((current) => ({ ...current, message }));
    },
    handleNameChange: (name) => {
      setFields((current) => ({ ...current, name }));
    },
    handleSubmit,
    pending: action.pending,
  };
}

export { useContactForm };
export type { ContactFormState };
