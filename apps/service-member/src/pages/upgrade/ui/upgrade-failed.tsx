import { Button, Heading, STATUS_VARIANT, StatusMessage } from "@repo/ui";
import { useRouter } from "@tanstack/react-router";

import type { ReactElement } from "react";

function UpgradeFailed(): ReactElement {
  const router = useRouter();
  function retry(): void {
    void router.invalidate();
  }
  return (
    <main className="mx-auto flex w-full max-w-column flex-col gap-4 px-4 py-8">
      <Heading as="h1" size="page">
        有料プラン
      </Heading>
      <StatusMessage variant={STATUS_VARIANT.failure}>
        料金の情報を取得できませんでした。
      </StatusMessage>
      <Button type="button" onClick={retry}>
        再試行
      </Button>
    </main>
  );
}

export { UpgradeFailed };
