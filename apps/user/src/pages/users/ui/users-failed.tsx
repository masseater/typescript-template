import { Button, Status } from "@template/ui/ui";
import type { ReactElement } from "react";
import { UsersBody } from "./users-body.tsx";
import { useRouter } from "@tanstack/react-router";

function UsersFailed(): ReactElement {
  const router = useRouter();
  function retry(): void {
    void router.invalidate();
  }
  return (
    <UsersBody>
      <Status variant="error">ユーザー一覧を取得できませんでした。</Status>
      <Button type="button" onClick={retry}>
        再試行
      </Button>
    </UsersBody>
  );
}

export { UsersFailed };
