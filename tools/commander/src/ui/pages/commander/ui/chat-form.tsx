import type { ReactElement } from "react";

import { useChatForm } from "#ui/pages/commander/model/use-chat-form.ts";
import { MessageBox } from "#ui/shared/ui/index.ts";
import { Button, Status } from "@repo/ui";

function ChatForm({ busy }: Readonly<{ busy: boolean }>): ReactElement {
  const form = useChatForm();
  return (
    <form aria-label="司令塔へ送る" onSubmit={form.handleSubmit} className="flex flex-col gap-2">
      <MessageBox
        label="メッセージ"
        value={form.text}
        onValueChange={form.handleText}
        onSend={form.handleSend}
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
