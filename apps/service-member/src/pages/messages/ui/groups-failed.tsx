import { Button, STATUS_VARIANT, StatusMessage } from "@repo/ui";
import { useRouter } from "@tanstack/react-router";

import { GroupsBody } from "./open-groups-page.tsx";

import type { ReactElement } from "react";

function GroupsFailed(): ReactElement {
  const router = useRouter();
  function retry(): void {
    void router.invalidate();
  }
  return (
    <GroupsBody>
      <StatusMessage variant={STATUS_VARIANT.failure}>
        グループを取得できませんでした。
      </StatusMessage>
      <Button type="button" onClick={retry}>
        再試行
      </Button>
    </GroupsBody>
  );
}

export { GroupsFailed };
