import {
  FieldKey,
  Reply,
  fieldDefinitions,
  fieldKeys,
  readValue,
  readValues,
  validEntries,
} from "./sheet.ts";
import { Option, Schema } from "effect";
import type { InterviewState } from "./state.ts";
import type { SheetData } from "./sheet.ts";

const maximumQuestion = 300;

const questionLength = Schema.isLengthBetween(1, maximumQuestion);
const askedSchemas = { ask: FieldKey, message: Schema.Trim.check(questionLength), reply: Reply };
const Asked = Schema.Struct({
  ask: Schema.optionalKey(askedSchemas.ask),
  message: Schema.optionalKey(askedSchemas.message),
  reply: Schema.optionalKey(askedSchemas.reply),
});
const decodeAsked = Schema.decodeUnknownOption(Asked);

type Understanding = typeof Asked.Type & {
  readonly finish: boolean;
  readonly skip: boolean;
  readonly values: SheetData;
};

const finishPattern =
  /^(?:もう)?(?:終わり|おわり|おしまい|終了|終わる|終わらせて|やめる|やめたい|いい|いいよ|十分)(?:で|です|にして|にします|にしたい|ください)?(?:お願いします)?[。!！]?$/u;
const skipPattern =
  /^(?:スキップ|パス|飛ばして|とばして|次へ|答えたくない)(?:で|です|します|してください|ください)?(?:お願いします)?[。!！]?$/u;
const correctionPattern =
  /^(?<label>[^はを:：]+)\s*[はを:：]\s*(?<value>.+?)(?:に(?:して|変えて|変更して)(?:ください)?)?。?$/u;

interface ModelOutput {
  readonly finish: boolean;
  readonly skip: boolean;
  readonly values: unknown;
}

function readUnderstanding(output: ModelOutput): Understanding {
  const asked = Option.getOrElse(decodeAsked(validEntries(output, askedSchemas)), () => ({}));
  return { ...asked, finish: output.finish, skip: output.skip, values: readValues(output.values) };
}

function correction(text: string): SheetData {
  const groups = correctionPattern.exec(text)?.groups;
  const label = groups?.["label"]?.trim();
  const key = fieldKeys.find((candidate) => fieldDefinitions[candidate].label === label);
  const value = groups?.["value"];
  return key === undefined || value === undefined ? {} : readValue(key, [value]);
}

function answer(state: InterviewState, text: string): SheetData {
  return state.current === undefined || state.reply?.kind === "confirm"
    ? {}
    : readValue(state.current, [text]);
}

function understandByRules(state: InterviewState, text: string): Understanding {
  if (state.phase !== "asking") {
    return { finish: false, skip: false, values: correction(text) };
  }
  const finish = finishPattern.test(text);
  const skip = !finish && skipPattern.test(text);
  return { finish, skip, values: finish || skip ? {} : answer(state, text) };
}

export { readUnderstanding, understandByRules };
export type { Understanding };
