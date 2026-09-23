import { logAt, logCause } from "@repo/observability";
import { FileStore } from "@repo/runtime";
import { Cause, Effect } from "effect";

import { CoreRecords } from "./core-records.ts";
import { Transcriber, transcriptionModel } from "./transcriber.ts";
import { TranscriptionFailed } from "./transcription-failed.ts";

const dependencyFailures: ReadonlySet<TranscriptionFailed["reason"]> = new Set([
  "invalid_output",
  "model_failed",
]);

function transcriptionFailure(recordingId: string, failed: TranscriptionFailed) {
  const attributes = {
    "recording.failure": failed.reason,
    "recording.id": recordingId,
    "recording.model": transcriptionModel,
  };
  return dependencyFailures.has(failed.reason)
    ? logCause({
        attributes,
        cause: Cause.fail(failed),
        eventName: "recording.transcription_failed",
      })
    : logAt("Warn", { attributes, eventName: "recording.transcription_failed" });
}

const transcribeJob = Effect.fn("transcribeJob")(function* transcribeJob(jobId: string) {
  const core = yield* CoreRecords;
  const started = yield* core.beginTranscription({ jobId });
  if (started === undefined) {
    return { jobId, outcome: "superseded" as const };
  }
  const recordingId = started.id;
  return yield* Effect.gen(function* transcribeRecording() {
    const audio = yield* (yield* FileStore).open(started.objectKey);
    if (audio === undefined) {
      return yield* new TranscriptionFailed({ reason: "audio_missing" });
    }
    const transcript = yield* (yield* Transcriber).transcribe({
      body: audio.body,
      contentType: started.contentType,
    });
    const stored = yield* core.storeTranscript({ recordingId, transcript });
    const waitedMs = stored.completedAt - started.createdAt;
    yield* logAt("Info", {
      attributes: {
        "recording.audio_bytes": audio.size,
        "recording.duration_ms": transcript.durationMs,
        "recording.id": recordingId,
        "recording.model": transcriptionModel,
        "recording.segments": transcript.segments.length,
        "recording.speakers": stored.speakers,
        "recording.waited_ms": waitedMs,
      },
      eventName: "recording.transcribed",
    });
    return { jobId, outcome: "done" as const };
  }).pipe(
    Effect.catchTag("TranscriptionFailed", (failed) =>
      core
        .failRecording({ failure: failed.reason, recordingId })
        .pipe(
          Effect.andThen(transcriptionFailure(recordingId, failed)),
          Effect.as({ jobId, outcome: "failed" as const }),
        ),
    ),
  );
});

export { transcribeJob };
