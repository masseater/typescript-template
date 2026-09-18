import type { ReactElement } from "react";
import { useState } from "react";

import { Button, Field, Status } from "@repo/ui";

import { usePost } from "./use-post.ts";

function CommentForm({ taskId }: Readonly<{ taskId: string }>): ReactElement {
  const [text, setText] = useState("");
  const comment = usePost(`/api/tasks/${encodeURIComponent(taskId)}/comments`);

  async function submit(): Promise<void> {
    const body = text.trim();
    if (body !== "" && (await comment.send({ text: body }))) {
      setText("");
    }
  }

  function handleSubmit(event: Readonly<{ preventDefault: () => void }>): void {
    event.preventDefault();
    void submit();
  }

  return (
    <form aria-label="ワーカーへ伝える" onSubmit={handleSubmit} className="flex flex-col gap-2">
      <Field label="コメント" name="text" multiline value={text} onValueChange={setText} />
      <p className="text-sm text-muted-foreground">
        届くのは次のチェックポイント（最長 10 分）です。返事もここに出ます。
      </p>
      <Button type="submit" variant="primary" disabled={comment.pending || text.trim() === ""}>
        ワーカーへ伝える
      </Button>
      {comment.failed ? <Status variant="error">コメントを送れませんでした。</Status> : undefined}
    </form>
  );
}

export { CommentForm };
