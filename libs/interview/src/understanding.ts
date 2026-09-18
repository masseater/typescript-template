import { Schema } from "effect";

import {
  FieldKey,
  ReadableSheet,
  Reply,
  fieldDefinitions,
  fieldKeys,
  readValue,
  readable,
  type SheetData,
} from "./sheet.ts";

import type { InterviewState } from "./state.ts";

const maximumQuestion = 300;

const Question = Schema.Trim.check(Schema.isLengthBetween(1, maximumQuestion));
const Understanding = Schema.Struct({
  ask: readable(FieldKey),
  finish: Schema.Boolean,
  message: readable(Question),
  reply: readable(Reply),
  skip: Schema.Boolean,
  values: ReadableSheet,
});

type UnderstandingData = typeof Understanding.Type;

const finishPattern =
  /^(?:(?:もう)?(?:終わり|おわり|おしまい|終了|終わる|終わらせて|やめる|やめたい)|もう(?:いい|いいよ|十分))(?:で|です|にして|にします|にしたい|ください)?(?:お願いします)?[。!！]?$/u;
const skipPattern =
  /^(?:スキップ|パス|飛ばして|とばして|次へ|答えたくない)(?:で|です|します|してください|ください)?(?:お願いします)?[。!！]?$/u;
const correctionPattern =
  /^(?<label>[^はを:：]+)\s*[はを:：]\s*(?<value>.+?)(?:に(?:して|変えて|変更して)(?:ください)?)?。?$/u;

const correction = (text: string): SheetData => {
  const groups = correctionPattern.exec(text)?.groups;
  const label = groups?.label?.trim();
  const key = fieldKeys.find((candidate) => fieldDefinitions[candidate].label === label);
  const value = groups?.value;
  return key === undefined || value === undefined ? {} : readValue(key, [value]);
};

const understandByRules = (state: InterviewState, text: string): UnderstandingData => {
  if (state.phase !== "asking") {
    return { finish: false, skip: false, values: correction(text) };
  }
  const finish = finishPattern.test(text);
  const skip = !finish && skipPattern.test(text);
  const answers = !finish && !skip && state.reply?.kind !== "confirm";
  return { finish, skip, values: answers ? readValue(state.current, [text]) : {} };
};

export { Understanding, understandByRules };
export type { UnderstandingData };
