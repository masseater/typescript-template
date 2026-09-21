import { Button, Field, FormColumn, STATUS_VARIANT, StatusMessage } from "@repo/ui";

import { useComposeForm } from "#pages/messages/model/compose-form.ts";
import { maximumMessageBodyLength } from "#shared/contracts/index.ts";

import type { ReactElement } from "react";

function ComposeForm({
  recipientId,
  recipientName,
}: Readonly<{ recipientId: string; recipientName: string }>): ReactElement {
  const form = useComposeForm(recipientId);
  return (
    <form aria-label={`${recipientName}へのメッセージ`} onSubmit={form.handleSubmit}>
      <FormColumn>
        <p className="text-base leading-normal">{recipientName}へ最初のメッセージを送ります。</p>
        <Field
          multiline
          label="メッセージ"
          name="body"
          required
          maxLength={maximumMessageBodyLength}
          value={form.body}
          onValueChange={form.handleBodyChange}
        />
        <div>
          <Button disabled={form.blocked} type="submit" variant="primary">
            送信
          </Button>
        </div>
        {form.error !== undefined && (
          <StatusMessage variant={STATUS_VARIANT.failure}>{form.error}</StatusMessage>
        )}
      </FormColumn>
    </form>
  );
}

export { ComposeForm };
