import { RecordingSummary, RecordingView, RegisteredPerson, SpeakerLabel } from "@repo/config";
import { Identifier } from "@repo/runtime/contracts";
import { Schema } from "effect";

const maximumRecordingTitleLength = 100;
const maximumPersonNameLength = 50;
const maximumRecordingBytes = 100 * 1024 * 1024;

const RecordingList = Schema.Struct({ recordings: Schema.Array(RecordingSummary) });

const RecordingUpload = Schema.Struct({
  title: Schema.Trim.check(Schema.isLengthBetween(1, maximumRecordingTitleLength)),
});

type RecordingView = typeof RecordingView.Type;

const SpeakerAssignment = Schema.Struct({
  label: SpeakerLabel,
  personId: Schema.NullOr(Identifier),
  recordingId: Identifier,
});

const PeopleList = Schema.Struct({ people: Schema.Array(RegisteredPerson) });

const PersonRegistration = Schema.Struct({
  consent: Schema.Literal(true),
  name: Schema.Trim.check(Schema.isLengthBetween(1, maximumPersonNameLength)),
});

export {
  PeopleList,
  PersonRegistration,
  RecordingList,
  RecordingUpload,
  RecordingView,
  SpeakerAssignment,
  maximumPersonNameLength,
  maximumRecordingBytes,
  maximumRecordingTitleLength,
};
