import { APPLICATION } from "@repo/config";
import { STATUS_VARIANT, StatusMessage } from "@repo/ui";

import type { ChatNotice, ChatState } from "#shared/contract/index.ts";
import type { ReactElement } from "react";

type Body = ChatState["entries"][number]["body"];

const notices: Readonly<Record<ChatNotice, string>> = {
  denied: "司令塔が許可されていない操作をしようとしたので、その操作は止めました。",
  failed: "司令塔を実行できませんでした。もう一度送ってください。",
  session_restarted: "前の会話を引き継げなかったので、新しい会話で始め直しました。",
  stopped: "止めました。",
  woken: "タスクに動きがあったので、司令塔が確認しています。",
};
const calm: ReadonlySet<ChatNotice> = new Set(["stopped", "woken"]);

function ChatEntry({ body }: Readonly<{ body: Body }>): ReactElement {
  if (body.kind === APPLICATION.user) {
    return (
      <p className="ml-8 self-end rounded-lg bg-primary px-3 py-2 whitespace-pre-wrap text-primary-foreground">
        {body.text}
      </p>
    );
  }
  if (body.kind === "commander") {
    return <p className="mr-8 whitespace-pre-wrap text-foreground">{body.text}</p>;
  }
  if (body.kind === "tool") {
    return <p className="truncate text-sm text-muted-foreground">› {body.summary}</p>;
  }
  return (
    <StatusMessage variant={calm.has(body.notice) ? STATUS_VARIANT.info : STATUS_VARIANT.failure}>
      {notices[body.notice]}
    </StatusMessage>
  );
}

export { ChatEntry };
