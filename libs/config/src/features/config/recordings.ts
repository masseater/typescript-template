/** @canonical-values config.recording-status */
export const recordingStatuses = ["queued", "transcribing", "done", "failed"] as const;
export type RecordingStatus = (typeof recordingStatuses)[number];
export const RECORDING_STATUS = {
  queued: recordingStatuses[0],
  transcribing: recordingStatuses[1],
  done: recordingStatuses[2],
  failed: recordingStatuses[3],
} as const;

/** @canonical-values config.transcription-failure */
export const transcriptionFailures = [
  "unavailable",
  "model_failed",
  "invalid_output",
  "audio_missing",
] as const;
/** @canonical-values config.recording-failure */
export const recordingFailures = [...transcriptionFailures, "enqueue_failed"] as const;
export type RecordingFailure = (typeof recordingFailures)[number];
