import { recordingFailures, recordingStatuses } from "@repo/config";
import { Schema } from "effect";

const SpeakerLabel = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

const RecordingSummary = Schema.Struct({
  createdAt: Schema.Finite,
  durationMs: Schema.NullOr(Schema.Finite),
  failure: Schema.NullOr(Schema.Literals(recordingFailures)),
  id: Schema.String,
  ownerName: Schema.NullOr(Schema.String),
  status: Schema.Literals(recordingStatuses),
  title: Schema.String,
});

const RecordingSegment = Schema.Struct({
  endMs: Schema.Finite,
  speakerLabel: SpeakerLabel,
  startMs: Schema.Finite,
  text: Schema.String,
});

const RecordingSpeaker = Schema.Struct({
  label: SpeakerLabel,
  person: Schema.NullOr(Schema.Struct({ id: Schema.String, name: Schema.String })),
});

const RecordingView = Schema.Struct({
  recording: RecordingSummary,
  segments: Schema.Array(RecordingSegment),
  speakers: Schema.Array(RecordingSpeaker),
});

const RegisteredPerson = Schema.Struct({
  consentedAt: Schema.Finite,
  id: Schema.String,
  name: Schema.String,
});

export {
  RecordingSegment,
  RecordingSpeaker,
  RecordingSummary,
  RecordingView,
  RegisteredPerson,
  SpeakerLabel,
};
