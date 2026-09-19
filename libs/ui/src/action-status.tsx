import { StatusMessage } from "./shared/ui/status";
import { STATUS_VARIANT } from "./shared/ui/status-variants.ts";

import type { ReactElement } from "react";
import type { ActionState } from "./action";

const ActionStatus = ({
  action,
  notice,
  pendingMessage,
}: {
  readonly action: ActionState;
  readonly notice?: string | undefined;
  readonly pendingMessage?: string;
}): ReactElement => {
  return (
    <>
      {action.pending && pendingMessage !== undefined && (
        <StatusMessage variant={STATUS_VARIANT.pending}>{pendingMessage}</StatusMessage>
      )}
      {notice !== undefined && (
        <StatusMessage variant={STATUS_VARIANT.success}>{notice}</StatusMessage>
      )}
      {action.error !== undefined && (
        <StatusMessage variant={STATUS_VARIANT.failure}>{action.error}</StatusMessage>
      )}
    </>
  );
};

export { ActionStatus };
