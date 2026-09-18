import type { ReactElement } from "react";

import { Button, Status } from "@template/ui";

function FailedResults({
  message,
  onReload,
}: Readonly<{ message: string; onReload: () => void }>): ReactElement {
  return (
    <div className="flex flex-col items-start gap-2">
      <Status variant="error">一覧を取得できませんでした。{message}</Status>
      <Button type="button" onClick={onReload}>
        再試行
      </Button>
    </div>
  );
}

export { FailedResults };
