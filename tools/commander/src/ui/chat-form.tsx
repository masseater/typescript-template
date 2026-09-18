import { Button, Status } from "@repo/ui";
import type { ReactElement } from "react";
import { useChatForm } from "./use-chat-form.ts";

function ChatForm({ busy }: Readonly<{ busy: boolean }>): ReactElement {
  const form = useChatForm();
  return (
    <form aria-label="司令塔へ送る" onSubmit={form.handleSubmit} className="flex flex-col gap-2">
      <textarea
        aria-label="メッセージ"
        name="text"
        value={form.text}
        onChange={form.handleChange}
        onKeyDown={form.handleKeyDown}
        className="box-border field-sizing-content min-h-16 w-full rounded-md border border-input bg-card px-1 py-1.5 text-base text-foreground outline-none focus-visible:focus-indicator"
      />
      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary" disabled={!form.sendable}>
          送信
        </Button>
        {busy ? (
          <Button type="button" onClick={form.handleStop} disabled={!form.stoppable}>
            止める
          </Button>
        ) : undefined}
      </div>
      {form.failed ? (
        <Status variant="error">送れませんでした。アプリが動いているか確認してください。</Status>
      ) : undefined}
    </form>
  );
}

export { ChatForm };
