import { ROLE } from "@repo/config";
import { Schema } from "effect";

import { FieldKey, Reply, Sheet, maximumOptions } from "./sheet.ts";

const maximumUtterance = 500;

const roles = ["interviewer", ROLE.member] as const;
const settledPhases = ["summary", "saved"] as const;

const Progress = Schema.Struct({ sheet: Sheet, skipped: Schema.Array(FieldKey) });
const Message = Schema.Struct({
  card: Schema.optionalKey(Progress),
  role: Schema.Literals(roles),
  text: Schema.String,
});
const conversation = { ...Progress.fields, messages: Schema.Array(Message) };

const State = Schema.Union([
  Schema.Struct({
    ...conversation,
    current: FieldKey,
    phase: Schema.Literal("asking"),
    reply: Schema.optionalKey(Reply),
  }),
  Schema.Struct({ ...conversation, phase: Schema.Literals(settledPhases) }),
]);

const utteranceLength = Schema.isLengthBetween(1, maximumUtterance);
const choiceCount = Schema.isLengthBetween(1, maximumOptions);
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

export { State, Utterance, maximumUtterance, roles, settledPhases };
export type { InterviewState, MemberUtterance };
