import { Button, STATUS_VARIANT, StatusMessage } from "@repo/ui";
import { useState } from "react";

import { useComment } from "#pages/commander/model/actions.ts";
import { MessageBox } from "#shared/ui/index.ts";

import type { ReactElement } from "react";

function CommentForm({ taskId }: Readonly<{ taskId: string }>): ReactElement {
  const [text, setText] = useState("");
  const comment = useComment(taskId);

  function handleSend(): void {
    const body = text.trim();
    if (body !== "") {
      comment.mutate(body, {
        onSuccess: () => {
          setText("");
        },
      });
    }
  }

  function handleSubmit(event: Readonly<{ preventDefault: () => void }>): void {
    event.preventDefault();
    handleSend();
  }

  return (
    <form aria-label="ワーカーへ伝える" onSubmit={handleSubmit} className="flex flex-col gap-2">
      <MessageBox label="コメント" value={text} onValueChange={setText} onSend={handleSend} />
      <p className="text-sm text-muted-foreground">
        ワーカーが読むのは次のチェックポイントです。返事もここに出ます。
      </p>
      <Button type="submit" variant="primary" disabled={comment.isPending || text.trim() === ""}>
        ワーカーへ伝える
      </Button>
      {comment.isError ? (
        <StatusMessage variant={STATUS_VARIANT.failure}>コメントを送れませんでした。</StatusMessage>
      ) : undefined}
    </form>
  );
}

export { CommentForm };
