import { StatusMessage } from "./shared/ui/status";
import { STATUS_VARIANT } from "./shared/ui/status-variants.ts";

import type { ReactElement } from "react";

const FailureStatus = ({
  error,
}: Readonly<{ error: string | undefined }>): ReactElement | undefined =>
  error === undefined ? undefined : (
    <StatusMessage variant={STATUS_VARIANT.failure}>{error}</StatusMessage>
  );

export { FailureStatus };
