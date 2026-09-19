import { Button, STATUS_VARIANT, StatusMessage } from "@repo/ui";

import type { ReactElement } from "react";

function FailedResults({
  message,
  onReload,
}: Readonly<{ message: string; onReload: () => void }>): ReactElement {
  return (
    <div className="flex flex-col items-start gap-2">
      <StatusMessage variant={STATUS_VARIANT.failure}>
        一覧を取得できませんでした。{message}
      </StatusMessage>
      <Button type="button" onClick={onReload}>
        再試行
      </Button>
    </div>
  );
}

export { FailedResults };
