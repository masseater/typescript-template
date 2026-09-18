import { useRouter } from "@tanstack/react-router";
import { Button, Page, Status } from "@template/ui";

import type { ReactElement } from "react";

const ProfileFailed = (): ReactElement => {
  const router = useRouter();
  const retry = (): void => {
    void router.invalidate();
  };
  return (
    <Page title="プロフィール">
      <Status variant="error">プロフィールを取得できませんでした。</Status>
      <Button type="button" onClick={retry}>
        再試行
      </Button>
    </Page>
  );
};

export { ProfileFailed };
