import { FieldKey, Reply, Sheet } from "./sheet.ts";
import { Schema } from "effect";

const maximumUtterance = 500;
const maximumChoices = 8;

const Message = Schema.Struct({
  role: Schema.Literals(["interviewer", "member"]),
  sheet: Schema.optionalKey(Sheet),
  text: Schema.String,
});

const State = Schema.Struct({
  current: Schema.optionalKey(FieldKey),
  messages: Schema.Array(Message),
  phase: Schema.Literals(["asking", "summary", "saved"]),
  reply: Schema.optionalKey(Reply),
  sheet: Sheet,
  skipped: Schema.Array(FieldKey),
});

const utteranceLength = Schema.isLengthBetween(1, maximumUtterance);
const choiceCount = Schema.isLengthBetween(1, maximumChoices);
const Utterance = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("text"), text: Schema.Trim.check(utteranceLength) }),
  Schema.Struct({
    kind: Schema.Literal("choice"),
    values: Schema.Array(Schema.String).check(choiceCount),
  }),
  Schema.Struct({ kind: Schema.Literal("skip") }),
  Schema.Struct({ kind: Schema.Literal("finish") }),
]);

type InterviewState = typeof State.Type;
type MemberUtterance = typeof Utterance.Type;

export { State, Utterance };
export type { InterviewState, MemberUtterance };
