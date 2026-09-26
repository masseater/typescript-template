import { RECORDING_STATUS, type RecordingFailure, type RecordingStatus } from "@repo/config";
import { and, desc, eq } from "drizzle-orm";
import { Effect } from "effect";

import { clockDate } from "./clock-date.ts";
import { query, type DrizzleDatabase } from "./database.ts";
import { freshId } from "./fresh-id.ts";
import { RecordingNotFound } from "./recording-not-found.ts";
import { RecordingNotRetryable } from "./recording-not-retryable.ts";
import { recording, recordingSegment, recordingSpeaker, speakerPerson, user } from "./schema.ts";
import { SpeakerPersonNotFound } from "./speaker-person-not-found.ts";

const listedRecordings = 100;
const segmentColumns = 6;
const boundParameterLimit = 100;
const segmentsPerInsert = Math.floor(boundParameterLimit / segmentColumns);

const summaryColumns = {
  createdAt: recording.createdAt,
  durationMs: recording.durationMs,
  failure: recording.failure,
  id: recording.id,
  ownerName: user.name,
  status: recording.status,
  title: recording.title,
};

type StoredSummary = {
  readonly createdAt: Readonly<Date>;
  readonly durationMs: number | null;
  readonly failure: RecordingFailure | null;
  readonly id: string;
  readonly ownerName: string | null;
  readonly status: RecordingStatus;
  readonly title: string;
};

const shownSummary = (
  stored: StoredSummary,
): Omit<StoredSummary, "createdAt"> & {
  readonly createdAt: number;
} => ({ ...stored, createdAt: stored.createdAt.getTime() });

type SegmentRecord = {
  readonly endMs: number;
  readonly position: number;
  readonly recordingId: string;
  readonly speakerLabel: number;
  readonly startMs: number;
  readonly text: string;
};

const segmentBatches = (
  segmentRecords: readonly SegmentRecord[],
): readonly (readonly SegmentRecord[])[] =>
  Array.from({ length: Math.ceil(segmentRecords.length / segmentsPerInsert) }, (_unused, batch) =>
    segmentRecords.slice(batch * segmentsPerInsert, (batch + 1) * segmentsPerInsert),
  );

const transcriptStatements = (
  database: DrizzleDatabase,
  stored: Readonly<{
    completedAt: Readonly<Date>;
    durationMs: number;
    recordingId: string;
    segmentRecords: readonly SegmentRecord[];
    speakerLabels: readonly number[];
  }>,
) =>
  [
    database.delete(recordingSegment).where(eq(recordingSegment.recordingId, stored.recordingId)),
    ...segmentBatches(stored.segmentRecords).map((batch) =>
      database.insert(recordingSegment).values([...batch]),
    ),
    ...stored.speakerLabels.map((speakerLabel) =>
      database
        .insert(recordingSpeaker)
        .values({ label: speakerLabel, recordingId: stored.recordingId })
        .onConflictDoNothing(),
    ),
    database
      .update(recording)
      .set({
        completedAt: stored.completedAt,
        durationMs: stored.durationMs,
        failure: null,
        status: RECORDING_STATUS.transcribed,
      })
      .where(eq(recording.id, stored.recordingId)),
  ] as const;

const createRecording = Effect.fn("createRecording")(function* createRecording(
  queuedRecording: Readonly<{
    byteSize: number;
    contentType: string;
    id: string;
    jobId: string;
    objectKey: string;
    ownerId: string;
    title: string;
  }>,
) {
  const createdAt = yield* clockDate;
  yield* query((database) =>
    database
      .insert(recording)
      .values({ ...queuedRecording, createdAt, status: RECORDING_STATUS.queued }),
  );
});

const listRecordings = Effect.fn("listRecordings")(function* listRecordings() {
  const summaries = yield* query((database) =>
    database
      .select(summaryColumns)
      .from(recording)
      .leftJoin(user, eq(user.id, recording.ownerId))
      .orderBy(desc(recording.createdAt), desc(recording.id))
      .limit(listedRecordings),
  );
  return summaries.map(shownSummary);
});

const findRecording = Effect.fn("findRecording")(function* findRecording(recordingId: string) {
  const [found] = yield* query((database) =>
    database
      .select(summaryColumns)
      .from(recording)
      .leftJoin(user, eq(user.id, recording.ownerId))
      .where(eq(recording.id, recordingId))
      .limit(1),
  );
  if (found === undefined) {
    return yield* new RecordingNotFound();
  }
  const [segments, speakers] = yield* Effect.all(
    [
      query((database) =>
        database
          .select({
            endMs: recordingSegment.endMs,
            speakerLabel: recordingSegment.speakerLabel,
            startMs: recordingSegment.startMs,
            text: recordingSegment.text,
          })
          .from(recordingSegment)
          .where(eq(recordingSegment.recordingId, recordingId))
          .orderBy(recordingSegment.position),
      ),
      query((database) =>
        database
          .select({
            label: recordingSpeaker.label,
            personId: speakerPerson.id,
            personName: speakerPerson.name,
          })
          .from(recordingSpeaker)
          .leftJoin(speakerPerson, eq(speakerPerson.id, recordingSpeaker.personId))
          .where(eq(recordingSpeaker.recordingId, recordingId))
          .orderBy(recordingSpeaker.label),
      ),
    ],
    { concurrency: "unbounded" },
  );
  return {
    recording: shownSummary(found),
    segments,
    speakers: speakers.map((speaker) => ({
      label: speaker.label,
      person:
        speaker.personId === null || speaker.personName === null
          ? null
          : { id: speaker.personId, name: speaker.personName },
    })),
  };
});

const beginTranscription = Effect.fn("beginTranscription")(function* beginTranscription(
  jobId: string,
) {
  const [started] = yield* query((database) =>
    database
      .update(recording)
      .set({ failure: null, status: RECORDING_STATUS.transcribing })
      .where(eq(recording.jobId, jobId))
      .returning({
        contentType: recording.contentType,
        createdAt: recording.createdAt,
        id: recording.id,
        objectKey: recording.objectKey,
      }),
  );
  return started === undefined ? undefined : { ...started, createdAt: started.createdAt.getTime() };
});

const storeTranscript = Effect.fn("storeTranscript")(function* storeTranscript(
  recordingId: string,
  transcript: Readonly<{
    durationMs: number;
    segments: readonly Readonly<{
      endMs: number;
      speakerLabel: number;
      startMs: number;
      text: string;
    }>[];
  }>,
) {
  const completedAt = yield* clockDate;
  const speakerLabels = [...new Set(transcript.segments.map((segment) => segment.speakerLabel))];
  const segmentRecords = transcript.segments.map((segment, position) => ({
    ...segment,
    position,
    recordingId,
  }));
  yield* query((database) =>
    database.batch(
      transcriptStatements(database, {
        completedAt,
        durationMs: transcript.durationMs,
        recordingId,
        segmentRecords,
        speakerLabels,
      }),
    ),
  );
  return { completedAt: completedAt.getTime(), speakers: speakerLabels.length };
});

const failRecording = Effect.fn("failRecording")(function* failRecording(
  recordingId: string,
  failure: RecordingFailure,
) {
  yield* query((database) =>
    database
      .update(recording)
      .set({ failure, status: RECORDING_STATUS.transcriptionFailed })
      .where(eq(recording.id, recordingId)),
  );
});

const retryRecording = Effect.fn("retryRecording")(function* retryRecording(
  recordingId: string,
  jobId: string,
) {
  const [retried] = yield* query((database) =>
    database
      .update(recording)
      .set({ failure: null, jobId, status: RECORDING_STATUS.queued })
      .where(and(eq(recording.id, recordingId), eq(recording.status, RECORDING_STATUS.transcriptionFailed)))
      .returning({ id: recording.id }),
  );
  if (retried === undefined) {
    return yield* new RecordingNotRetryable();
  }
});

const deleteRecording = Effect.fn("deleteRecording")(function* deleteRecording(
  recordingId: string,
) {
  const [deleted] = yield* query((database) =>
    database
      .delete(recording)
      .where(eq(recording.id, recordingId))
      .returning({ objectKey: recording.objectKey }),
  );
  if (deleted === undefined) {
    return yield* new RecordingNotFound();
  }
  return deleted.objectKey;
});

const assignSpeaker = Effect.fn("assignSpeaker")(function* assignSpeaker(
  assignment: Readonly<{ label: number; personId: string | null; recordingId: string }>,
) {
  const { personId } = assignment;
  if (personId !== null) {
    const [person] = yield* query((database) =>
      database
        .select({ id: speakerPerson.id })
        .from(speakerPerson)
        .where(eq(speakerPerson.id, personId))
        .limit(1),
    );
    if (person === undefined) {
      return yield* new SpeakerPersonNotFound();
    }
  }
  const [assigned] = yield* query((database) =>
    database
      .update(recordingSpeaker)
      .set({ personId })
      .where(
        and(
          eq(recordingSpeaker.recordingId, assignment.recordingId),
          eq(recordingSpeaker.label, assignment.label),
        ),
      )
      .returning({ label: recordingSpeaker.label }),
  );
  if (assigned === undefined) {
    return yield* new RecordingNotFound();
  }
});

const listPeople = Effect.fn("listPeople")(function* listPeople() {
  const people = yield* query((database) =>
    database
      .select({
        consentedAt: speakerPerson.consentedAt,
        id: speakerPerson.id,
        name: speakerPerson.name,
      })
      .from(speakerPerson)
      .orderBy(speakerPerson.name, speakerPerson.id),
  );
  return people.map((person) => ({ ...person, consentedAt: person.consentedAt.getTime() }));
});

const registerPerson = Effect.fn("registerPerson")(function* registerPerson(
  personName: string,
  consentRecordedBy: string,
) {
  const consentedAt = yield* clockDate;
  const personId = yield* freshId;
  yield* query((database) =>
    database
      .insert(speakerPerson)
      .values({ consentRecordedBy, consentedAt, id: personId, name: personName }),
  );
  return personId;
});

const removePerson = Effect.fn("removePerson")(function* removePerson(personId: string) {
  const [removed] = yield* query((database) =>
    database
      .delete(speakerPerson)
      .where(eq(speakerPerson.id, personId))
      .returning({ id: speakerPerson.id }),
  );
  if (removed === undefined) {
    return yield* new SpeakerPersonNotFound();
  }
});

export { RecordingNotFound } from "./recording-not-found.ts";
export { RecordingNotRetryable } from "./recording-not-retryable.ts";
export { SpeakerPersonNotFound } from "./speaker-person-not-found.ts";
export {
  assignSpeaker,
  beginTranscription,
  createRecording,
  deleteRecording,
  failRecording,
  findRecording,
  listPeople,
  listRecordings,
  registerPerson,
  removePerson,
  retryRecording,
  storeTranscript,
};
