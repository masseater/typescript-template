import { authClient, requireSuccess } from "@repo/auth-ui";
import { localState, useAction } from "@repo/ui";

import { submitLeave } from "#pages/settings/api/leave.ts";

interface LeaveFormState {
  readonly blocked: boolean;
  readonly confirming: boolean;
  readonly handleConfirm: () => void;
  readonly handleOpenChange: (open: boolean) => void;
  readonly error: string;
  readonly immediate: boolean;
  readonly pending: boolean;
  readonly setImmediate: (checked: boolean) => void;
}

const useLeaveConfirming = localState(false);
const useLeaveImmediate = localState(false);

function useLeaveForm(): LeaveFormState {
  const [confirming, setConfirming] = useLeaveConfirming();
  const [immediate, setImmediate] = useLeaveImmediate();
  const action = useAction();
  function handleConfirm(): void {
    action.run(async () => {
      await submitLeave({ immediate });
      requireSuccess(await authClient.signOut());
      globalThis.location.assign("/");
    });
  }
  return {
    blocked: action.blocked,
    confirming,
    handleConfirm,
    handleOpenChange: setConfirming,
    error: action.error ?? "",
    immediate,
    pending: action.pending,
    setImmediate,
  };
}

export { useLeaveForm };
