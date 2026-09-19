import { maximumContactMessageLength, maximumContactNameLength } from "@repo/runtime/contracts";
import { Button, Field, FormColumn, STATUS_VARIANT, StatusMessage } from "@repo/ui";

import type { ContactFormState } from "#pages/contact/model/contact-form.ts";
import type { ReactElement } from "react";

function ContactFormFields({ form }: Readonly<{ form: ContactFormState }>): ReactElement {
  return (
    <form onSubmit={form.handleSubmit}>
      <FormColumn>
        <Field
          label="お名前"
          name="name"
          autoComplete="name"
          required
          maxLength={maximumContactNameLength}
          value={form.name}
          onValueChange={form.handleNameChange}
        />
        <Field
          label="メールアドレス"
          name="email"
          type="email"
          autoComplete="username"
          required
          value={form.email}
          onValueChange={form.handleEmailChange}
        />
        <Field
          label="内容"
          name="message"
          multiline
          required
          maxLength={maximumContactMessageLength}
          value={form.message}
          onValueChange={form.handleMessageChange}
        />
        <Button type="submit" variant="primary" disabled={form.blocked}>
          送信する
        </Button>
        {form.pending ? (
          <StatusMessage variant={STATUS_VARIANT.pending}>送信しています。</StatusMessage>
        ) : undefined}
        {form.error !== "" ? (
          <StatusMessage variant={STATUS_VARIANT.failure}>{form.error}</StatusMessage>
        ) : undefined}
      </FormColumn>
    </form>
  );
}

export { ContactFormFields };
