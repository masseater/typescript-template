import { useAction } from "@repo/ui";
import { useState } from "react";

import { submitRecover } from "#pages/recover/api/submit-recover.ts";

import type { SubmitEventHandler } from "react";

interface RecoverFormState {
  readonly blocked: boolean;
  readonly email: string;
  readonly error: string;
  readonly handleEmailChange: (value: string) => void;
  readonly handleSubmit: SubmitEventHandler<HTMLFormElement>;
  readonly pending: boolean;
}

function useRecoverForm(onRecovered: () => void): RecoverFormState {
  const [email, setEmail] = useState("");
  const action = useAction();
  function handleSubmit(event: Readonly<{ preventDefault: () => void }>): void {
    event.preventDefault();
    action.run(async () => {
      await submitRecover({ email });
      onRecovered();
    });
  }
  return {
    blocked: action.blocked,
    email,
    error: action.error ?? "",
    handleEmailChange: setEmail,
    handleSubmit,
    pending: action.pending,
  };
}

export { useRecoverForm };
