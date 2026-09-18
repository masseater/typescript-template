import { Status } from "./shared/ui/status";

import type { ReactElement } from "react";
import type { ActionState } from "./action";

interface ActionStatusProps {
  readonly action: ActionState;
  readonly notice?: string | undefined;
  readonly pendingMessage?: string;
}

function ActionStatus({ action, notice, pendingMessage }: ActionStatusProps): ReactElement {
  return (
    <>
      {action.pending && pendingMessage !== undefined && (
        <Status variant="pending">{pendingMessage}</Status>
      )}
      {notice !== undefined && <Status variant="success">{notice}</Status>}
      {action.error !== undefined && action.error !== "" && (
        <Status variant="error">{action.error}</Status>
      )}
    </>
  );
}

export { ActionStatus };
