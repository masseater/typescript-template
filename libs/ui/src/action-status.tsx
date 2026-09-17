import type { ActionState } from "./action";
import type { ReactElement } from "react";
import { Status } from "./status";

interface ActionStatusProps {
  readonly action: ActionState;
  readonly notice?: string | undefined;
  readonly pendingMessage?: string;
}

function ActionStatus({ action, notice, pendingMessage }: ActionStatusProps): ReactElement {
  return (
    <>
      {action.pending && pendingMessage !== undefined && <Status>{pendingMessage}</Status>}
      {notice !== undefined && <Status>{notice}</Status>}
      {action.error !== undefined && action.error !== "" && <Status error>{action.error}</Status>}
    </>
  );
}

export { ActionStatus };
