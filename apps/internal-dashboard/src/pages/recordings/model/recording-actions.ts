import { localState, useAction } from "@repo/ui";

import {
  assignSpeaker,
  deleteRecording,
  retryRecording,
} from "#pages/recordings/api/recordings.ts";

import type { RecordingActions } from "./recording-state.ts";

const useConfirmingDelete = localState(false);

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
