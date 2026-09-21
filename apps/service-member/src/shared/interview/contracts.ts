import { Schema } from "effect";

import { FieldKey, Reply, displayValue, fieldDefinitions, fieldKeys } from "./sheet.ts";
import { fieldStatuses, roles, settledPhases } from "./state.ts";

import type { FieldName, SheetData } from "./sheet.ts";
import type { InterviewState } from "./state.ts";

const FieldView = Schema.Struct({
  key: FieldKey,
  label: Schema.String,
  status: Schema.Literals(fieldStatuses),
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

const FIELD_STATUS = {
  answered: fieldStatuses[1],
  skipped: fieldStatuses[2],
  unanswered: fieldStatuses[0],
} as const;

function fieldViews(sheet: SheetData, skipped: readonly FieldName[]): readonly FieldViewData[] {
  const skippedFields = new Set(skipped);
  return fieldKeys.map((key) => {
    const value = displayValue(sheet, key);
    const { label } = fieldDefinitions[key];
    if (value !== undefined) {
      return { key, label, status: FIELD_STATUS.answered, value };
    }
    return {
      key,
      label,
      status: skippedFields.has(key) ? FIELD_STATUS.skipped : FIELD_STATUS.unanswered,
    };
  });
}

function viewOf(state: InterviewState): InterviewViewData {
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
}

export { InterviewView, viewOf };
export { Utterance } from "./state.ts";
