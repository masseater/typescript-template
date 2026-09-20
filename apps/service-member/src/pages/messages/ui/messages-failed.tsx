import { Button, STATUS_VARIANT, StatusMessage } from "@repo/ui";
import { useRouter } from "@tanstack/react-router";

import { MessagesBody } from "./messages-body.tsx";

import type { ReactElement } from "react";

function MessagesFailed(): ReactElement {
  const router = useRouter();
  function retry(): void {
    void router.invalidate();
  }
  return (
    <MessagesBody>
      <StatusMessage variant={STATUS_VARIANT.failure}>
        メッセージを取得できませんでした。
      </StatusMessage>
      <Button type="button" onClick={retry}>
        再試行
      </Button>
    </MessagesBody>
  );
}

export { MessagesFailed };
