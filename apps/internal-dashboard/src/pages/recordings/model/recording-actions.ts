import { localState, useAction } from "@repo/ui";

import {
  assignSpeaker,
  deleteRecording,
  retryRecording,
} from "#pages/recordings/api/recordings.ts";

const useConfirmingDelete = localState(false);

interface RecordingActions {
  readonly blocked: boolean;
  readonly confirmingDelete: boolean;
  readonly error: string | undefined;
  readonly handleAssign: (label: number, personId: string | null) => void;
  readonly handleConfirmDelete: () => void;
  readonly handleDeleteOpenChange: (open: boolean) => void;
  readonly handleRetry: () => void;
}

function useRecordingActions(
  recordingId: string,
  handlers: Readonly<{ onChanged: () => Promise<void>; onDeleted: () => Promise<void> }>,
): RecordingActions {
  const action = useAction();
  const [confirmingDelete, setConfirmingDelete] = useConfirmingDelete();
  return {
    blocked: action.blocked,
    confirmingDelete,
    error: action.error,
    handleAssign: (label, personId) => {
      action.run(() =>
        assignSpeaker(recordingId, label, personId).then(() => handlers.onChanged()),
      );
    },
    handleConfirmDelete: () => {
      setConfirmingDelete(false);
      action.run(() => deleteRecording(recordingId).then(() => handlers.onDeleted()));
    },
    handleDeleteOpenChange: setConfirmingDelete,
    handleRetry: () => {
      action.run(() => retryRecording(recordingId).then(() => handlers.onChanged()));
    },
  };
}

export { useRecordingActions };
