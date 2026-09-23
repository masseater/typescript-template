import { Button } from "./shared/ui/button";
import { StatusMessage } from "./shared/ui/status";
import { STATUS_VARIANT } from "./shared/ui/status-variants.ts";

import type { ReactElement } from "react";
import type { Children } from "./shared/ui/types";

const RetryableFailure = ({
  children,
  onRetry,
}: Children & Readonly<{ onRetry: () => void }>): ReactElement => {
  return (
    <div className="flex flex-col items-start gap-2">
      <StatusMessage variant={STATUS_VARIANT.failure}>{children}</StatusMessage>
      <Button type="button" onClick={onRetry}>
        {"再試行"}
      </Button>
    </div>
  );
};

export { RetryableFailure };
