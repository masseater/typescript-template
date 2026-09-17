import { Button, Page, Status } from "@template/ui/ui";
import type { ReactElement } from "react";
import { useCallback } from "react";
import { useRouter } from "@tanstack/react-router";

function ProfileFailed(): ReactElement {
  const router = useRouter();
  const retry = useCallback((): void => {
    void router.invalidate();
  }, [router]);
  return (
    <Page title="プロフィール">
      <Status variant="error">プロフィールを取得できませんでした。</Status>
      <Button type="button" onClick={retry}>
        再試行
      </Button>
    </Page>
  );
}

export { ProfileFailed };
