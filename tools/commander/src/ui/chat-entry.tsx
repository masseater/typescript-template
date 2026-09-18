import type { ReactElement } from "react";

import type { ChatNotice, ChatState } from "#contract.ts";
import { Status } from "@repo/ui";

type Body = ChatState["entries"][number]["body"];

const notices: Readonly<Record<ChatNotice, string>> = {
  denied: "司令塔が許可されていない操作をしようとしたので、その操作は止めました。",
  failed: "司令塔を実行できませんでした。もう一度送ってください。",
  session_restarted: "前の会話を引き継げなかったので、新しい会話で始め直しました。",
  stopped: "止めました。",
};

function ChatEntry({ body }: Readonly<{ body: Body }>): ReactElement {
  if (body.kind === "user") {
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
    <Status variant={body.notice === "stopped" ? "info" : "error"}>{notices[body.notice]}</Status>
  );
}

export { ChatEntry };
