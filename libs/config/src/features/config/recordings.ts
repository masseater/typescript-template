/** @canonical-values config.recording-status */
export const recordingStatuses = [
  "queued",
  "transcribing",
  "transcribed",
  "transcription_failed",
] as const;
export type RecordingStatus = (typeof recordingStatuses)[number];
export const RECORDING_STATUS = {
  queued: recordingStatuses[0],
  transcribing: recordingStatuses[1],
  done: recordingStatuses[2],
  failed: recordingStatuses[3],
} as const;

/** @canonical-values config.transcription-failure */
export const transcriptionFailures = [
  "ai_unbound",
  "model_rejected",
  "output_unreadable",
  "audio_missing",
] as const;
/** @canonical-values config.recording-failure */
export const recordingFailures = [...transcriptionFailures, "enqueue_failed"] as const;
export type RecordingFailure = (typeof recordingFailures)[number];
export const RECORDING_FAILURE = {
  aiUnbound: recordingFailures[0],
  modelRejected: recordingFailures[1],
  outputUnreadable: recordingFailures[2],
  audioMissing: recordingFailures[3],
  enqueueFailed: recordingFailures[4],
} as const;
