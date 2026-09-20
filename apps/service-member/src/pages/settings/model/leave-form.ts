import { authClient, requireSuccess } from "@repo/auth-ui";
import { useAction } from "@repo/ui";
import { useState } from "react";

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

function useLeaveForm(): LeaveFormState {
  const [confirming, setConfirming] = useState(false);
  const [immediate, setImmediate] = useState(false);
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
