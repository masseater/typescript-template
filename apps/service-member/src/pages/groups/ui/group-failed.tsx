import { Button, STATUS_VARIANT, StatusMessage } from "@repo/ui";
import { useRouter } from "@tanstack/react-router";

import { GroupBody } from "./group-body.tsx";

import type { ReactElement } from "react";

function GroupFailed(): ReactElement {
  const router = useRouter();
  function retry(): void {
    void router.invalidate();
  }
  return (
    <GroupBody>
      <StatusMessage variant={STATUS_VARIANT.failure}>
        グループを取得できませんでした。
      </StatusMessage>
      <Button type="button" onClick={retry}>
        再試行
      </Button>
    </GroupBody>
  );
}

export { GroupFailed };
