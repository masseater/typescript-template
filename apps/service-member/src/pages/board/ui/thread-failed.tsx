import { Button, STATUS_VARIANT, StatusMessage } from "@repo/ui";
import { useRouter } from "@tanstack/react-router";

import { ThreadBody } from "./thread-body.tsx";

import type { ReactElement } from "react";

function ThreadFailed(): ReactElement {
  const router = useRouter();
  function retry(): void {
    void router.invalidate();
  }
  return (
    <ThreadBody>
      <StatusMessage variant={STATUS_VARIANT.failure}>
        スレッドを取得できませんでした。
      </StatusMessage>
      <Button type="button" onClick={retry}>
        再試行
      </Button>
    </ThreadBody>
  );
}

export { ThreadFailed };
