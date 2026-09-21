import { Button, Field, FormColumn, STATUS_VARIANT, StatusMessage, useToast } from "@repo/ui";
import { useNavigate, useRouter } from "@tanstack/react-router";

import { pageSearch } from "#pages/messages/model/messages-search.ts";
import { useReplyForm } from "#pages/messages/model/reply-form.ts";
import { maximumMessageBodyLength } from "#shared/contracts/index.ts";

import type { ReactElement } from "react";

function ReplyForm({
  conversationId,
  lastPage,
}: Readonly<{ conversationId: string; lastPage: number }>): ReactElement {
  const navigate = useNavigate();
  const router = useRouter();
  const notify = useToast();
  async function showSent(): Promise<void> {
    await navigate({
      params: { id: conversationId },
      search: pageSearch(lastPage),
      to: "/messages/$id",
    });
    await router.invalidate();
    notify("success", "送信しました。");
  }
  const form = useReplyForm(conversationId, showSent);
  return (
    <form aria-busy={form.pending} onSubmit={form.handleSubmit}>
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

export { ReplyForm };
