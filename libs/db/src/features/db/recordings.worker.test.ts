import { RECORDING_STATUS } from "@repo/config";
import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import {
  assignSpeaker,
  beginTranscription,
  createRecording,
  failRecording,
  findRecording,
  listRecordings,
  registerPerson,
  removePerson,
  retryRecording,
  storeTranscript,
} from "./recordings.ts";
import { TestDatabase, runStatement } from "./testing.ts";

const heard = {
  durationMs: 4200,
  segments: [
    { endMs: 1500, speakerLabel: 0, startMs: 0, text: "始めます。" },
    { endMs: 4200, speakerLabel: 1, startMs: 1800, text: "お願いします。" },
  ],
};

const queuedMeeting = Effect.gen(function* queuedMeeting() {
  yield* runStatement(
    "INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 1, 0, 0)",
    "host",
    "host",
    "host@example.com",
  );
  yield* createRecording({
    byteSize: 3,
    contentType: "audio/mp4",
    id: "meeting",
    jobId: "first-job",
    objectKey: "recordings/meeting",
    ownerId: "host",
    title: "定例",
  });
});

describe("a transcribed recording", () => {
  const it = test.extend("transcribedMeeting", () =>
    Effect.runPromise(
      Effect.gen(function* program() {
        yield* queuedMeeting;
        const started = yield* beginTranscription("first-job");
        yield* storeTranscript("meeting", heard);
        const found = yield* findRecording("meeting");
        const listed = yield* listRecordings();
        return {
          listed: listed.map((summary) => summary.id),
          ownerName: found.recording.ownerName,
          segments: found.segments,
          speakers: found.speakers,
          startedKey: started?.objectKey,
          status: found.recording.status,
        };
      }).pipe(Effect.provide(TestDatabase)),
    ));

  it("keeps every segment and one unnamed speaker per voice", ({ transcribedMeeting }) => {
    expect(transcribedMeeting).toStrictEqual({
      listed: ["meeting"],
      ownerName: "host",
      segments: heard.segments,
      speakers: [
        { label: 0, person: null },
        { label: 1, person: null },
      ],
      startedKey: "recordings/meeting",
      status: RECORDING_STATUS.done,
    });
  });
});

describe("a retried recording", () => {
  const it = test.extend("retriedMeeting", () =>
    Effect.runPromise(
      Effect.gen(function* program() {
        yield* queuedMeeting;
        const early = yield* retryRecording("meeting", "second-job").pipe(Effect.flip);
        yield* failRecording("meeting", "model_failed");
        yield* retryRecording("meeting", "second-job");
        const replaced = yield* beginTranscription("first-job");
        const { recording } = yield* findRecording("meeting");
        return {
          earlyTag: early._tag,
          failure: recording.failure,
          replacedJob: replaced === undefined,
          status: recording.status,
        };
      }).pipe(Effect.provide(TestDatabase)),
    ));

  it("queues again only after failing and ignores the job it replaced", ({ retriedMeeting }) => {
    expect(retriedMeeting).toStrictEqual({
      earlyTag: "RecordingNotRetryable",
      failure: null,
      replacedJob: true,
      status: RECORDING_STATUS.queued,
    });
  });
});

describe("a named speaker", () => {
  const it = test.extend("speakerNames", () =>
    Effect.runPromise(
      Effect.gen(function* program() {
        yield* queuedMeeting;
        yield* storeTranscript("meeting", heard);
        const unknownPerson = yield* assignSpeaker({
          label: 0,
          personId: "missing",
          recordingId: "meeting",
        }).pipe(Effect.flip);
        const personId = yield* registerPerson("田中", "host");
        const unknownLabel = yield* assignSpeaker({
          label: 5,
          personId,
          recordingId: "meeting",
        }).pipe(Effect.flip);
        yield* assignSpeaker({ label: 0, personId, recordingId: "meeting" });
        const [named] = (yield* findRecording("meeting")).speakers;
        yield* removePerson(personId);
        const [forgotten] = (yield* findRecording("meeting")).speakers;
        return {
          forgottenPerson: forgotten?.person,
          namedPerson: named?.person?.name,
          namedPersonMatches: named?.person?.id === personId,
          unknownLabelTag: unknownLabel._tag,
          unknownPersonTag: unknownPerson._tag,
        };
      }).pipe(Effect.provide(TestDatabase)),
    ));

  it("takes a registered person's name and drops it when the person is removed", ({
    speakerNames,
  }) => {
    expect(speakerNames).toStrictEqual({
      forgottenPerson: null,
      namedPerson: "田中",
      namedPersonMatches: true,
      unknownLabelTag: "RecordingNotFound",
      unknownPersonTag: "SpeakerPersonNotFound",
    });
  });
});
