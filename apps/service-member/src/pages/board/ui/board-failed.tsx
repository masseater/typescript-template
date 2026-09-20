import { Button, STATUS_VARIANT, StatusMessage } from "@repo/ui";
import { useRouter } from "@tanstack/react-router";

import { BoardBody } from "./board-body.tsx";

import type { ReactElement } from "react";

function BoardFailed(): ReactElement {
  const router = useRouter();
  function retry(): void {
    void router.invalidate();
  }
  return (
    <BoardBody>
      <StatusMessage variant={STATUS_VARIANT.failure}>掲示板を取得できませんでした。</StatusMessage>
      <Button type="button" onClick={retry}>
        再試行
      </Button>
    </BoardBody>
  );
}

export { BoardFailed };
