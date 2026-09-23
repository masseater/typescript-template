import { assert, describe, it } from "@effect/vitest";
import { RECORDING_STATUS } from "@repo/config";
import { FileStore } from "@repo/runtime";
import { applyD1Migrations, reset, type D1Migration } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { Effect, Layer } from "effect";

import { CoreRecords } from "./core-records.ts";
import { transcribeJob } from "./transcribe-job.ts";
import { Transcriber } from "./transcriber.ts";
import { TranscriptionFailed } from "./transcription-failed.ts";

import type { Transcript } from "./transcript.ts";

declare global {
  namespace Cloudflare {
    interface Env {
      readonly CORE: Fetcher;
      readonly TEST_MIGRATIONS: D1Migration[];
    }
  }
}

const migrated = Effect.promise(() => reset()).pipe(
  Effect.andThen(Effect.promise(() => applyD1Migrations(env.DB, env.TEST_MIGRATIONS))),
);

const heard: Transcript = {
  durationMs: 4200,
  segments: [
    { endMs: 1500, speakerLabel: 0, startMs: 0, text: "始めます。" },
    { endMs: 4200, speakerLabel: 1, startMs: 1800, text: "お願いします。" },
  ],
};

function services(transcribe: Parameters<typeof Transcriber.of>[0]["transcribe"]) {
  return Layer.mergeAll(
    CoreRecords.layer(env.CORE),
    Layer.orDie(FileStore.fromEnvironment(env)),
    Layer.succeed(Transcriber, Transcriber.of({ transcribe })),
  );
}

const storedRecording = Effect.fn("storedRecording")(function* storedRecording(withAudio: boolean) {
  const id = crypto.randomUUID();
  const jobId = crypto.randomUUID();
  const objectKey = `recordings/${id}`;
  if (withAudio) {
    yield* (yield* FileStore).put(objectKey, {
      bytes: new Uint8Array([1, 2, 3]),
      contentType: "audio/mp4",
    });
  }
  const ownerId = crypto.randomUUID();
  yield* Effect.promise(() =>
    env.DB.prepare(
      "INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 1, 0, 0)",
    )
      .bind(ownerId, "host", `${ownerId}@example.test`)
      .run(),
  );
  yield* (yield* CoreRecords).createRecording({
    byteSize: 3,
    contentType: "audio/mp4",
    id,
    jobId,
    objectKey,
    ownerId,
    title: "定例",
  });
  return { id, jobId };
});

describe("transcribeJob", () => {
  it.effect("stores the transcript and one speaker row per voice", () =>
    Effect.gen(function* program() {
      yield* migrated;
      const { id, jobId } = yield* storedRecording(true);
      const outcome = yield* transcribeJob(jobId);
      const found = yield* (yield* CoreRecords).findRecording({ recordingId: id });
      assert.deepStrictEqual(outcome, { jobId, outcome: "done" });
      assert.strictEqual(found.recording.status, RECORDING_STATUS.done);
      assert.strictEqual(found.recording.durationMs, heard.durationMs);
      assert.deepStrictEqual(found.segments, heard.segments);
      assert.deepStrictEqual(found.speakers, [
        { label: 0, person: null },
        { label: 1, person: null },
      ]);
    }).pipe(Effect.provide(services(() => Effect.succeed(heard)))),
  );

  it.effect("marks the recording failed when the model fails", () =>
    Effect.gen(function* program() {
      yield* migrated;
      const { id, jobId } = yield* storedRecording(true);
      const outcome = yield* transcribeJob(jobId);
      const found = yield* (yield* CoreRecords).findRecording({ recordingId: id });
      assert.deepStrictEqual(outcome, { jobId, outcome: "failed" });
      assert.strictEqual(found.recording.status, RECORDING_STATUS.failed);
      assert.strictEqual(found.recording.failure, "model_failed");
    }).pipe(
      Effect.provide(
        services(() => Effect.fail(new TranscriptionFailed({ reason: "model_failed" }))),
      ),
    ),
  );

  it.effect("marks the recording failed when its audio is gone", () =>
    Effect.gen(function* program() {
      yield* migrated;
      const { id, jobId } = yield* storedRecording(false);
      yield* transcribeJob(jobId);
      const found = yield* (yield* CoreRecords).findRecording({ recordingId: id });
      assert.strictEqual(found.recording.failure, "audio_missing");
    }).pipe(Effect.provide(services(() => Effect.succeed(heard)))),
  );

  it.effect("ignores a job that a retry has replaced", () =>
    Effect.gen(function* program() {
      yield* migrated;
      const outcome = yield* transcribeJob("replaced-job");
      assert.deepStrictEqual(outcome, { jobId: "replaced-job", outcome: "superseded" });
    }).pipe(Effect.provide(services(() => Effect.succeed(heard)))),
  );
});
