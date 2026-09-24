import { RetryableFailure } from "@repo/ui";

import type { ReactElement } from "react";

function FailedResults({
  message,
  onReload,
}: Readonly<{ message: string; onReload: () => void }>): ReactElement {
  return (
    <RetryableFailure onRetry={onReload}>一覧を取得できませんでした。{message}</RetryableFailure>
  );
}

export { FailedResults };
