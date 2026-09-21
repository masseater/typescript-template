import { Button, Field, FormColumn, STATUS_VARIANT, StatusMessage, useToast } from "@repo/ui";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { Effect } from "effect";

import { pageSearch } from "#pages/board/model/board-search.ts";
import { useReplyForm } from "#pages/board/model/reply-form.ts";
import { maximumBoardBodyLength } from "#shared/contracts/index.ts";

import type { ReactElement } from "react";

function ReplyForm({
  lastPage,
  threadId,
}: Readonly<{ lastPage: number; threadId: string }>): ReactElement {
  const navigate = useNavigate();
  const router = useRouter();
  const notify = useToast();
  function showPosted(): Promise<void> {
    return Effect.runPromise(
      Effect.gen(function* afterReply() {
        yield* Effect.promise(() =>
          navigate({ params: { id: threadId }, search: pageSearch(lastPage), to: "/board/$id" }),
        );
        yield* Effect.promise(() => router.invalidate());
        notify("success", "投稿しました。");
      }),
    );
  }
  const form = useReplyForm(threadId, showPosted);
  return (
    <form onSubmit={form.handleSubmit} aria-busy={form.pending}>
      <FormColumn>
        <Field
          multiline
          label="返信"
          name="body"
          required
          maxLength={maximumBoardBodyLength}
          value={form.body}
          onValueChange={form.handleBodyChange}
        />
        <div>
          <Button type="submit" variant="primary" disabled={form.blocked}>
            投稿する
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
