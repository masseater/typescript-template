import {
  RecordingSegment,
  RecordingSpeaker,
  RecordingSummary,
  RecordingView,
  RegisteredPerson,
  SpeakerLabel,
} from "@repo/core-api/recording-schemas";
import { Schema } from "effect";

const maximumRecordingTitleLength = 100;
const maximumPersonNameLength = 50;
const maximumIdentifierLength = 64;
const maximumRecordingBytes = 100 * 1024 * 1024;

const Identifier = Schema.String.check(Schema.isLengthBetween(1, maximumIdentifierLength));

type RecordingSummary = typeof RecordingSummary.Type;

const RecordingList = Schema.Struct({ recordings: Schema.Array(RecordingSummary) });

const RecordingUpload = Schema.Struct({
  title: Schema.Trim.check(Schema.isLengthBetween(1, maximumRecordingTitleLength)),
});

const RecordingQuery = Schema.Struct({ id: Identifier });

type RecordingSegment = typeof RecordingSegment.Type;

type RecordingSpeaker = typeof RecordingSpeaker.Type;

type RecordingView = typeof RecordingView.Type;

const RecordingTarget = Schema.Struct({ id: Identifier });

const RecordingAccepted = Schema.Struct({ id: Schema.String });

const SpeakerAssignment = Schema.Struct({
  label: SpeakerLabel,
  personId: Schema.NullOr(Identifier),
  recordingId: Identifier,
});

type RegisteredPerson = typeof RegisteredPerson.Type;

const PeopleList = Schema.Struct({ people: Schema.Array(RegisteredPerson) });

const PersonRegistration = Schema.Struct({
  consent: Schema.Literal(true),
  name: Schema.Trim.check(Schema.isLengthBetween(1, maximumPersonNameLength)),
});

export {
  PeopleList,
  PersonRegistration,
  RecordingAccepted,
  RecordingList,
  RecordingQuery,
  RecordingSegment,
  RecordingSpeaker,
  RecordingSummary,
  RecordingTarget,
  RecordingUpload,
  RecordingView,
  RegisteredPerson,
  SpeakerAssignment,
  maximumPersonNameLength,
  maximumRecordingBytes,
  maximumRecordingTitleLength,
};
