import { Button, Field, FormColumn, STATUS_VARIANT, StatusMessage, useToast } from "@repo/ui";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { Effect } from "effect";

import { pageSearch } from "#pages/board/model/board-search.ts";
import { useReplyForm } from "#pages/board/model/reply-form.ts";
import { maximumBoardBodyLength } from "#shared/contracts/index.ts";

import type { ReactElement } from "react";

function showPosted(
  threadId: string,
  lastPage: number,
  goToThread: (threadId: string, lastPage: number) => Promise<unknown>,
  invalidate: () => Promise<unknown>,
  notify: (kind: "success", message: string) => void,
): Promise<void> {
  return Effect.runPromise(
    Effect.gen(function* afterReply() {
      yield* Effect.promise(() => goToThread(threadId, lastPage));
      yield* Effect.promise(() => invalidate());
      notify("success", "投稿しました。");
    }),
  );
}

function ReplyForm({
  lastPage,
  threadId,
}: Readonly<{ lastPage: number; threadId: string }>): ReactElement {
  const navigate = useNavigate();
  const router = useRouter();
  const notify = useToast();
  const form = useReplyForm(threadId, () =>
    showPosted(
      threadId,
      lastPage,
      (id, page) => navigate({ params: { id }, search: pageSearch(page), to: "/board/$id" }),
      () => router.invalidate(),
      notify,
    ),
  );
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
