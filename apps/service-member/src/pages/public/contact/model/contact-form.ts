import { useAction } from "@repo/ui";
import { useState } from "react";

import { submitContact } from "#pages/public/contact/api/submit-contact.ts";

import type { SubmitEventHandler } from "react";

interface ContactFormState {
  readonly blocked: boolean;
  readonly email: string;
  readonly error: string;
  readonly handleEmailChange: (value: string) => void;
  readonly handleMessageChange: (value: string) => void;
  readonly handleNameChange: (value: string) => void;
  readonly handleSubmit: SubmitEventHandler<HTMLFormElement>;
  readonly message: string;
  readonly name: string;
  readonly pending: boolean;
}

function useContactForm(onSent: () => void): ContactFormState {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const action = useAction();
  function handleSubmit(event: Readonly<{ preventDefault: () => void }>): void {
    event.preventDefault();
    action.run(async () => {
      await submitContact({ email, message, name });
      onSent();
    });
  }
  return {
    blocked: action.blocked,
    email,
    error: action.error ?? "",
    handleEmailChange: setEmail,
    handleMessageChange: setMessage,
    handleNameChange: setName,
    handleSubmit,
    message,
    name,
    pending: action.pending,
  };
}

export { useContactForm };
export type { ContactFormState };
