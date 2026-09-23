import { recordingFailures } from "@repo/config";
import {
  DatabaseFailure,
  RecordingNotFound,
  RecordingNotRetryable,
  SpeakerPersonNotFound,
} from "@repo/db";
import { Schema } from "effect";
import { Rpc } from "effect/unstable/rpc";

import {
  RecordingSegment,
  RecordingSummary,
  RecordingView,
  RegisteredPerson,
  SpeakerLabel,
} from "./recording-schemas.ts";

const createRecording = Rpc.make("createRecording", {
  error: DatabaseFailure,
  payload: {
    byteSize: Schema.Int,
    contentType: Schema.String,
    id: Schema.String,
    jobId: Schema.String,
    objectKey: Schema.String,
    ownerId: Schema.String,
    title: Schema.String,
  },
});

const listRecordings = Rpc.make("listRecordings", {
  error: DatabaseFailure,
  payload: {},
  success: Schema.Array(RecordingSummary),
});

const findRecording = Rpc.make("findRecording", {
  error: Schema.Union([DatabaseFailure, RecordingNotFound]),
  payload: { recordingId: Schema.String },
  success: RecordingView,
});

const beginTranscription = Rpc.make("beginTranscription", {
  error: DatabaseFailure,
  payload: { jobId: Schema.String },
  success: Schema.UndefinedOr(
    Schema.Struct({
      contentType: Schema.String,
      createdAt: Schema.Finite,
      id: Schema.String,
      objectKey: Schema.String,
    }),
  ),
});

const storeTranscript = Rpc.make("storeTranscript", {
  error: DatabaseFailure,
  payload: {
    recordingId: Schema.String,
    transcript: Schema.Struct({
      durationMs: Schema.Finite,
      segments: Schema.Array(RecordingSegment),
    }),
  },
  success: Schema.Struct({ completedAt: Schema.Finite, speakers: Schema.Int }),
});

const failRecording = Rpc.make("failRecording", {
  error: DatabaseFailure,
  payload: { failure: Schema.Literals(recordingFailures), recordingId: Schema.String },
});

const retryRecording = Rpc.make("retryRecording", {
  error: Schema.Union([DatabaseFailure, RecordingNotRetryable]),
  payload: { jobId: Schema.String, recordingId: Schema.String },
});

const deleteRecording = Rpc.make("deleteRecording", {
  error: Schema.Union([DatabaseFailure, RecordingNotFound]),
  payload: { recordingId: Schema.String },
  success: Schema.String,
});

const assignSpeaker = Rpc.make("assignSpeaker", {
  error: Schema.Union([DatabaseFailure, RecordingNotFound, SpeakerPersonNotFound]),
  payload: {
    label: SpeakerLabel,
    personId: Schema.NullOr(Schema.String),
    recordingId: Schema.String,
  },
});

const listPeople = Rpc.make("listPeople", {
  error: DatabaseFailure,
  payload: {},
  success: Schema.Array(RegisteredPerson),
});

const registerPerson = Rpc.make("registerPerson", {
  error: DatabaseFailure,
  payload: { consentRecordedBy: Schema.String, name: Schema.String },
  success: Schema.String,
});

const removePerson = Rpc.make("removePerson", {
  error: Schema.Union([DatabaseFailure, SpeakerPersonNotFound]),
  payload: { personId: Schema.String },
});

const recordingRpcs = [
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
] as const;

export { recordingRpcs };
