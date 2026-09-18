import {
  fieldDefinitions,
  fieldKeys,
  maximumInterests,
  readValue,
  type FieldName,
  type ReplyForm,
  type SheetData,
} from "./sheet.ts";
import { understandByRules, type UnderstandingData } from "./understanding.ts";

import type { InterviewState, MemberUtterance } from "./state.ts";

const summaryText =
  "ここまでの内容をまとめました。直したいところがあれば、そのまま教えてください。";

type Asked = {
  readonly reply?: ReplyForm;
  readonly text: string;
};

type Asking = Extract<InterviewState, { readonly phase: "asking" }>;
type Settled = Exclude<InterviewState, Asking>;
type Progress = Pick<InterviewState, "messages" | "sheet" | "skipped">;
type Message = InterviewState["messages"][number];

const nextField = (sheet: SheetData, skipped: readonly FieldName[]): FieldName | undefined => {
  return fieldKeys.find((key) => sheet[key] === undefined && !skipped.includes(key));
};

const cannedQuestion = (key: FieldName, opening: string): Asked => {
  const { question, reply } = fieldDefinitions[key];
  return { text: `${opening}${question}`, ...(reply === undefined ? {} : { reply }) };
};

const maximumMessages = 100;

const says = (progress: Progress, message: Message): InterviewState["messages"] => {
  return [...progress.messages, message].slice(-maximumMessages);
};

const summarizing = (progress: Progress, opening: string): Settled => {
  const { sheet, skipped } = progress;
  const text = `${opening}${summaryText}`;
  return {
    messages: says(progress, { card: { sheet, skipped }, role: "interviewer", text }),
    phase: "summary",
    sheet,
    skipped,
  };
};

const asking = (progress: Progress, key: FieldName, asked: Asked): Asking => {
  return {
    current: key,
    messages: says(progress, { role: "interviewer", text: asked.text }),
    phase: "asking",
    sheet: progress.sheet,
    skipped: progress.skipped,
    ...(asked.reply === undefined ? {} : { reply: asked.reply }),
  };
};

const begin = (): Asking => {
  const progress = { messages: [], sheet: {}, skipped: [] };
  return asking(progress, "nickname", cannedQuestion("nickname", "はじめまして。"));
};

const offered = (reply: ReplyForm | undefined, values: readonly string[]): boolean => {
  if (reply === undefined || reply.kind === "confirm") {
    return false;
  }
  const limit = reply.kind === "multiple" ? maximumInterests : 1;
  return (
    values.length <= limit &&
    new Set(values).size === values.length &&
    values.every((value) => reply.options.includes(value))
  );
};

const accepts = (state: InterviewState, utterance: MemberUtterance): boolean => {
  if (utterance.kind === "text") {
    return true;
  }
  return (
    state.phase === "asking" &&
    (utterance.kind !== "choice" || offered(state.reply, utterance.values))
  );
};

const needsModel = (utterance: MemberUtterance): boolean => {
  return utterance.kind === "text" || utterance.kind === "choice";
};

const interpret = (
  state: InterviewState,
  utterance: MemberUtterance,
  understood?: UnderstandingData,
): UnderstandingData => {
  if (utterance.kind === "text") {
    return understood ?? understandByRules(state, utterance.text);
  }
  if (utterance.kind === "choice" && state.phase === "asking") {
    const values = readValue(state.current, utterance.values);
    return { ...understood, finish: false, skip: false, values };
  }
  return { finish: utterance.kind === "finish", skip: utterance.kind === "skip", values: {} };
};

const merged = (
  state: InterviewState,
  understanding: UnderstandingData,
): Pick<InterviewState, "sheet" | "skipped"> => {
  const sheet = { ...state.sheet, ...understanding.values };
  const skippedNow =
    understanding.skip && state.phase === "asking" && sheet[state.current] === undefined
      ? [state.current]
      : [];
  const skipped = [...state.skipped.filter((key) => sheet[key] === undefined), ...skippedNow];
  return { sheet, skipped };
};

const thanks = "ありがとうございます。";

const openingFor = (
  state: Asking,
  understanding: UnderstandingData,
  skipped: readonly FieldName[],
): string => {
  if (skipped.length > state.skipped.length) {
    return "わかりました、飛ばしますね。";
  }
  return Object.keys(understanding.values).length > 0
    ? thanks
    : "すみません、うまく受け取れませんでした。";
};

const modelQuestion = (next: FieldName, understanding: UnderstandingData): Asked | undefined => {
  const { ask, message, reply } = understanding;
  if (ask !== next || message === undefined) {
    return undefined;
  }
  const fits = reply !== undefined && (reply.kind !== "multiple" || next === "interests");
  return { text: message, ...(fits ? { reply } : {}) };
};

const afterAnswer = (state: Asking, understanding: UnderstandingData): InterviewState => {
  const progress = { messages: state.messages, ...merged(state, understanding) };
  if (understanding.finish) {
    return summarizing(progress, "わかりました、ここまでにしますね。");
  }
  const next = nextField(progress.sheet, progress.skipped);
  if (next === undefined) {
    return summarizing(progress, thanks);
  }
  const scripted = cannedQuestion(next, openingFor(state, understanding, progress.skipped));
  return asking(progress, next, modelQuestion(next, understanding) ?? scripted);
};

const afterCorrection = (state: Settled, understanding: UnderstandingData): Settled => {
  if (Object.keys(understanding.values).length === 0) {
    const text = "どの項目をどう直すかを、「職種は〇〇」のように教えてください。";
    return { ...state, messages: says(state, { role: "interviewer", text }) };
  }
  return summarizing({ messages: state.messages, ...merged(state, understanding) }, "直しました。");
};

const spoken = (utterance: MemberUtterance): string => {
  if (utterance.kind === "text") {
    return utterance.text;
  }
  if (utterance.kind === "choice") {
    return utterance.values.join("、");
  }
  return utterance.kind === "skip" ? "スキップ" : "ここで終える";
};

const advance = (
  state: InterviewState,
  utterance: MemberUtterance,
  understood?: UnderstandingData,
): InterviewState => {
  const understanding = interpret(state, utterance, understood);
  const messages = says(state, { role: "member", text: spoken(utterance) });
  return state.phase === "asking"
    ? afterAnswer({ ...state, messages }, understanding)
    : afterCorrection({ ...state, messages }, understanding);
};

const save = (state: Settled): Settled => {
  const text = "保存しました。";
  return { ...state, messages: says(state, { role: "interviewer", text }), phase: "saved" };
};

export { accepts, advance, begin, needsModel, save, spoken };
