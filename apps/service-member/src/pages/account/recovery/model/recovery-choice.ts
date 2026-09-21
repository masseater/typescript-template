import { useAction } from "@repo/ui";

import { acceptRecovery, declineRecovery } from "#pages/account/recovery/api/recovery.ts";

interface RecoveryChoiceState {
  readonly blocked: boolean;
  readonly error: string;
  readonly handleAccept: () => void;
  readonly handleDecline: () => void;
  readonly pending: boolean;
}

function useRecoveryChoice(onDecided: () => void): RecoveryChoiceState {
  const action = useAction();
  function handleAccept(): void {
    action.run(async () => {
      await acceptRecovery();
      onDecided();
    });
  }
  function handleDecline(): void {
    action.run(async () => {
      await declineRecovery();
      onDecided();
    });
  }
  return {
    blocked: action.blocked,
    error: action.error ?? "",
    handleAccept,
    handleDecline,
    pending: action.pending,
  };
}

export { useRecoveryChoice };
