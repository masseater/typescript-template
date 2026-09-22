import { Button, STATUS_VARIANT, StatusMessage } from "@repo/ui";
import { useRouter } from "@tanstack/react-router";

import { ConversationBody } from "./conversation-body.tsx";

import type { ReactElement } from "react";

function ConversationFailed(): ReactElement {
  const router = useRouter();
  function retry(): void {
    void router.invalidate();
  }
  return (
    <ConversationBody>
      <StatusMessage variant={STATUS_VARIANT.failure}>会話を取得できませんでした。</StatusMessage>
      <Button type="button" onClick={retry}>
        再試行
      </Button>
    </ConversationBody>
  );
}

export { ConversationFailed };
