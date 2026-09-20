import { Button, Field, FormColumn, STATUS_VARIANT, StatusMessage } from "@repo/ui";

import { maximumContactMessageLength, maximumContactNameLength } from "#shared/contracts/index.ts";
import { fieldError } from "#shared/forms/index.ts";

import type { useContactForm } from "#pages/contact/model/contact-form.ts";
import type { ReactElement, FormEvent } from "react";

function ContactFormFields({
  formState,
}: Readonly<{ formState: ReturnType<typeof useContactForm> }>): ReactElement {
  const { blocked, error, form, pending } = formState;
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    event.stopPropagation();
    void form.handleSubmit();
  }
  return (
    <form noValidate onSubmit={handleSubmit}>
      <FormColumn>
        <form.Field name="name">
          {(field) => (
            <Field
              label="お名前"
              name="name"
              autoComplete="name"
              maxLength={maximumContactNameLength}
              value={field.state.value}
              onValueChange={field.handleChange}
              error={fieldError(field.state.meta.errors)}
            />
          )}
        </form.Field>
        <form.Field name="email">
          {(field) => (
            <Field
              label="メールアドレス"
              name="email"
              type="email"
              autoComplete="username"
              value={field.state.value}
              onValueChange={field.handleChange}
              error={fieldError(field.state.meta.errors)}
            />
          )}
        </form.Field>
        <form.Field name="message">
          {(field) => (
            <Field
              label="内容"
              name="message"
              multiline
              maxLength={maximumContactMessageLength}
              value={field.state.value}
              onValueChange={field.handleChange}
              error={fieldError(field.state.meta.errors)}
            />
          )}
        </form.Field>
        <Button type="submit" variant="primary" disabled={blocked}>
          送信する
        </Button>
        {pending ? (
          <StatusMessage variant={STATUS_VARIANT.pending}>送信しています。</StatusMessage>
        ) : undefined}
        {error !== "" ? (
          <StatusMessage variant={STATUS_VARIANT.failure}>{error}</StatusMessage>
        ) : undefined}
      </FormColumn>
    </form>
  );
}

export { ContactFormFields };
