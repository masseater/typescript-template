import { Button, STATUS_VARIANT, StatusMessage } from "@repo/ui";
import { useRouter } from "@tanstack/react-router";

import { UsersBody } from "./users-body.tsx";

import type { ReactElement } from "react";

function UsersFailed(): ReactElement {
  const router = useRouter();
  function retry(): void {
    void router.invalidate();
  }
  return (
    <UsersBody>
      <StatusMessage variant={STATUS_VARIANT.failure}>
        ユーザー一覧を取得できませんでした。
      </StatusMessage>
      <Button type="button" onClick={retry}>
        再試行
      </Button>
    </UsersBody>
  );
}

export { UsersFailed };
