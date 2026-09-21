import { useAction, useTextInput } from "@repo/ui";

import { createInquiry } from "#pages/support/api/support.ts";

import type { SubmitEventHandler } from "react";

interface NewInquiryForm {
  readonly blocked: boolean;
  readonly body: string;
  readonly error: string | undefined;
  readonly handleBodyChange: (value: string) => void;
  readonly handleSubjectChange: (value: string) => void;
  readonly handleSubmit: SubmitEventHandler<HTMLFormElement>;
  readonly pending: boolean;
  readonly subject: string;
}

function useNewInquiryForm(onCreated: (inquiryId: string) => void): NewInquiryForm {
  const subject = useTextInput();
  const body = useTextInput();
  const action = useAction();
  function handleSubmit(event: Readonly<{ preventDefault: () => void }>): void {
    event.preventDefault();
    action.run(async () => {
      const created = await createInquiry({ body: body.value, subject: subject.value });
      onCreated(created.id);
    });
  }
  return {
    blocked: action.blocked,
    body: body.value,
    error: action.error,
    handleBodyChange: body.handleChange,
    handleSubjectChange: subject.handleChange,
    handleSubmit,
    pending: action.pending,
    subject: subject.value,
  };
}

export { useNewInquiryForm };
export type { NewInquiryForm };
