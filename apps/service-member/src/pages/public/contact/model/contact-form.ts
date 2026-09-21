import { useAction } from "@repo/ui";
import { useForm } from "@tanstack/react-form";
import { Schema } from "effect";

import { submitContact } from "#pages/public/contact/api/submit-contact.ts";
import { ContactSubmission } from "#shared/contracts/index.ts";

const contactSchema = Schema.toStandardSchemaV1(ContactSubmission);

type ContactValues = typeof ContactSubmission.Type;

function useContactForm(onSent: () => void) {
  const action = useAction();
  const form = useForm({
    defaultValues: { email: "", message: "", name: "" } satisfies ContactValues,
    onSubmit: ({ value }) => {
      action.run(async () => {
        await submitContact(value);
        onSent();
      });
    },
    validators: { onSubmit: contactSchema },
  });
  return {
    blocked: action.blocked,
    error: action.error ?? "",
    form,
    pending: action.pending,
  };
}

export { useContactForm };
