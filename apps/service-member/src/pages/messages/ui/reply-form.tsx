import { Button, Field, FormColumn, STATUS_VARIANT, StatusMessage } from "@repo/ui";
import { useRouter } from "@tanstack/react-router";

import { useReplyForm } from "#pages/messages/model/reply-form.ts";
import { maximumMessageBodyLength } from "#shared/contracts/index.ts";

import type { ReactElement } from "react";

function ReplyForm({ conversationId }: Readonly<{ conversationId: string }>): ReactElement {
  const router = useRouter();
  async function showSent(): Promise<void> {
    await router.invalidate();
  }
  const form = useReplyForm(conversationId, showSent);
  return (
    <form onSubmit={form.handleSubmit} aria-busy={form.pending}>
      <FormColumn>
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
          <Button type="submit" variant="primary" disabled={form.blocked}>
            送信する
          </Button>
        </div>
        {form.error !== undefined && (
          <StatusMessage variant={STATUS_VARIANT.failure}>{form.error}</StatusMessage>
        )}
      </FormColumn>
    </form>
  );
}

export { ReplyForm };
