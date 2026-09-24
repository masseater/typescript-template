import { resultError } from "./request";
import { settledValue, type ResultValue } from "./request-value";
import { RetryableFailure } from "./retryable-failure";
import { StatusMessage } from "./shared/ui/status";
import { STATUS_VARIANT } from "./shared/ui/status-variants.ts";

import type { ReactElement } from "react";
import type { UiNode } from "./shared/ui/types";

const RequestContent = <Settled extends object>({
  children,
  failureTitle,
  onRetry,
  fetched,
}: Readonly<{
  children: (loaded: ResultValue<Settled>) => UiNode;
  failureTitle: string;
  onRetry: () => void;
  fetched: Settled;
}>): ReactElement => {
  const failure = resultError(fetched);
  if (failure !== undefined) {
    return (
      <RetryableFailure onRetry={onRetry}>
        {failureTitle}
        {failure}
      </RetryableFailure>
    );
  }
  const loaded = settledValue(fetched);
  if (loaded === undefined) {
    return <StatusMessage variant={STATUS_VARIANT.pending}>{"読み込み中です。"}</StatusMessage>;
  }
  return <>{children(loaded)}</>;
};

export { RequestContent };
