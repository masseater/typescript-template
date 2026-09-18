import { Schema } from "effect";

import { FieldKey, Reply, displayValue, fieldDefinitions, fieldKeys } from "./sheet.ts";
import { roles, settledPhases } from "./state.ts";

import type { FieldName, SheetData } from "./sheet.ts";
import type { InterviewState } from "./state.ts";

const FieldView = Schema.Struct({
  key: FieldKey,
  label: Schema.String,
  status: Schema.Literals(["unanswered", "answered", "skipped"]),
  value: Schema.optionalKey(Schema.String),
});
const MessageView = Schema.Struct({
  card: Schema.optionalKey(Schema.Array(FieldView)),
  role: Schema.Literals(roles),
  text: Schema.String,
});
const InterviewView = Schema.Struct({
  fields: Schema.Array(FieldView),
  messages: Schema.Array(MessageView),
  phase: Schema.Literals(["asking", ...settledPhases]),
  reply: Schema.optionalKey(Reply),
});

type FieldViewData = typeof FieldView.Type;
type InterviewViewData = typeof InterviewView.Type;

const fieldViews = (sheet: SheetData, skipped: readonly FieldName[]): readonly FieldViewData[] => {
  return fieldKeys.map((key) => {
    const value = displayValue(sheet, key);
    const { label } = fieldDefinitions[key];
    if (value !== undefined) {
      return { key, label, status: "answered", value };
    }
    return { key, label, status: skipped.includes(key) ? "skipped" : "unanswered" };
  });
};

const viewOf = (state: InterviewState): InterviewViewData => {
  return {
    fields: fieldViews(state.sheet, state.skipped),
    messages: state.messages.map(({ card, role, text }) => ({
      role,
      text,
      ...(card === undefined ? {} : { card: fieldViews(card.sheet, card.skipped) }),
    })),
    phase: state.phase,
    ...(state.phase === "asking" && state.reply !== undefined ? { reply: state.reply } : {}),
  };
};

export { InterviewView, viewOf };
export { Utterance } from "./state.ts";
export type { InterviewViewData };
