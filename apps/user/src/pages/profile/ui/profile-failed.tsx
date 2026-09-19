import { Button, Page, STATUS_VARIANT, StatusMessage } from "@repo/ui";
import { useRouter } from "@tanstack/react-router";

import type { ReactElement } from "react";

function ProfileFailed(): ReactElement {
  const router = useRouter();
  function retry(): void {
    void router.invalidate();
  }
  return (
    <Page title="プロフィール">
      <StatusMessage variant={STATUS_VARIANT.failure}>
        プロフィールを取得できませんでした。
      </StatusMessage>
      <Button type="button" onClick={retry}>
        再試行
      </Button>
    </Page>
  );
}

export { ProfileFailed };
