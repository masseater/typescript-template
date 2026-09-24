import { STATUS_VARIANT, StatusMessage } from "@repo/ui";

import type { ReactElement } from "react";

function ActionFailure({
  error,
}: Readonly<{ error: string | undefined }>): ReactElement | undefined {
  if (error === undefined) {
    return undefined;
  }
  return <StatusMessage variant={STATUS_VARIANT.failure}>{error}</StatusMessage>;
}

export { ActionFailure };
