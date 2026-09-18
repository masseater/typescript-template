import type { ReactElement } from "react";
import { useState } from "react";

import { usePost } from "#ui/shared/api/index.ts";
import { MessageBox } from "#ui/shared/ui/index.ts";
import { Button, Status } from "@repo/ui";

function CommentForm({ taskId }: Readonly<{ taskId: string }>): ReactElement {
  const [text, setText] = useState("");
  const comment = usePost(`/api/tasks/${encodeURIComponent(taskId)}/comments`);

  async function submit(): Promise<void> {
    const body = text.trim();
    if (body !== "" && (await comment.send({ text: body }))) {
      setText("");
    }
  }

  function handleSend(): void {
    void submit();
  }

  function handleSubmit(event: Readonly<{ preventDefault: () => void }>): void {
    event.preventDefault();
    void submit();
  }

  return (
    <form aria-label="ワーカーへ伝える" onSubmit={handleSubmit} className="flex flex-col gap-2">
      <MessageBox label="コメント" value={text} onValueChange={setText} onSend={handleSend} />
      <p className="text-sm text-muted-foreground">
        ワーカーが読むのは次のチェックポイントです。返事もここに出ます。
      </p>
      <Button type="submit" variant="primary" disabled={comment.pending || text.trim() === ""}>
        ワーカーへ伝える
      </Button>
      {comment.failed ? <Status variant="error">コメントを送れませんでした。</Status> : undefined}
    </form>
  );
}

export { CommentForm };
