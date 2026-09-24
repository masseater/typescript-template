import { Button, Field, FormColumn, STATUS_VARIANT, StatusMessage } from "@repo/ui";

import type { ReactElement, SubmitEventHandler } from "react";

interface ReplyBodyFormState {
  readonly blocked: boolean;
  readonly body: string;
  readonly error: string | undefined;
  readonly handleBodyChange: (value: string) => void;
  readonly handleSubmit: SubmitEventHandler<HTMLFormElement>;
  readonly pending: boolean;
}

function ReplyBodyForm({
  form,
  label,
  maxLength,
  submitLabel,
}: Readonly<{
  form: ReplyBodyFormState;
  label: string;
  maxLength: number;
  submitLabel: string;
}>): ReactElement {
  return (
    <form onSubmit={form.handleSubmit} aria-busy={form.pending}>
      <FormColumn>
        <Field
          multiline
          label={label}
          name="body"
          maxLength={maxLength}
          value={form.body}
          onValueChange={form.handleBodyChange}
        />
        <div>
          <Button type="submit" variant="primary" disabled={form.blocked}>
            {submitLabel}
          </Button>
        </div>
        {form.error !== undefined && (
          <StatusMessage variant={STATUS_VARIANT.failure}>{form.error}</StatusMessage>
        )}
      </FormColumn>
    </form>
  );
}

export { ReplyBodyForm };
export type { ReplyBodyFormState };
