import type { FieldName, ReplyForm, SheetData } from "./sheet.ts";
import type { InterviewState, MemberUtterance } from "./state.ts";
import { fieldDefinitions, fieldKeys, readValue } from "./sheet.ts";
import type { Understanding } from "./understanding.ts";
import { understandByRules } from "./understanding.ts";

const maximumMessages = 100;
const thanks = "ありがとうございます。";
const summaryText =
  "ここまでの内容をまとめました。直したいところがあれば、そのまま教えてください。";

interface Asked {
  readonly reply?: ReplyForm;
  readonly text: string;
}

type Progress = Pick<InterviewState, "messages" | "sheet" | "skipped">;
type Message = InterviewState["messages"][number];

function nextField(sheet: SheetData, skipped: readonly FieldName[]): FieldName | undefined {
  return fieldKeys.find((key) => sheet[key] === undefined && !skipped.includes(key));
}

function cannedQuestion(key: FieldName, opening: string): Asked {
  const { question, reply } = fieldDefinitions[key];
  return { text: `${opening}${question}`, ...(reply === undefined ? {} : { reply }) };
}

function says(progress: Progress, message: Message): InterviewState["messages"] {
  return [...progress.messages, message].slice(-maximumMessages);
}

function asking(progress: Progress, key: FieldName, asked: Asked): InterviewState {
  return {
    current: key,
    messages: says(progress, { role: "interviewer", text: asked.text }),
    phase: "asking",
    sheet: progress.sheet,
    skipped: progress.skipped,
    ...(asked.reply === undefined ? {} : { reply: asked.reply }),
  };
}

function summarizing(progress: Progress, opening: string): InterviewState {
  const text = `${opening}${summaryText}`;
  return {
    messages: says(progress, { role: "interviewer", sheet: progress.sheet, text }),
    phase: "summary",
    sheet: progress.sheet,
    skipped: progress.skipped,
  };
}

function begin(): InterviewState {
  const progress = { messages: [], sheet: {}, skipped: [] };
  return asking(progress, "nickname", cannedQuestion("nickname", "はじめまして。"));
}

function spoken(utterance: MemberUtterance): string {
  if (utterance.kind === "text") {
    return utterance.text;
  }
  if (utterance.kind === "choice") {
    return utterance.values.join("、");
  }
  return utterance.kind === "skip" ? "スキップ" : "ここで終える";
}

function offered(state: InterviewState, values: readonly string[]): boolean {
  const { reply } = state;
  return (
    reply !== undefined &&
    reply.kind !== "confirm" &&
    (reply.kind === "multiple" || values.length === 1) &&
    values.every((value) => reply.options.includes(value))
  );
}

function accepts(state: InterviewState, utterance: MemberUtterance): boolean {
  if (utterance.kind === "text") {
    return true;
  }
  const chosen = utterance.kind !== "choice" || offered(state, utterance.values);
  return state.phase === "asking" && chosen;
}

function needsModel(utterance: MemberUtterance): boolean {
  return utterance.kind === "text" || utterance.kind === "choice";
}

function interpret(
  state: InterviewState,
  utterance: MemberUtterance,
  understood?: Understanding,
): Understanding {
  if (utterance.kind === "text") {
    return understood ?? understandByRules(state, utterance.text);
  }
  if (utterance.kind === "choice" && state.current !== undefined) {
    const values = readValue(state.current, utterance.values);
    return { ...understood, finish: false, skip: false, values };
  }
  return { finish: utterance.kind === "finish", skip: utterance.kind === "skip", values: {} };
}

function merged(
  state: InterviewState,
  understanding: Understanding,
): Pick<InterviewState, "sheet" | "skipped"> {
  const sheet = { ...state.sheet, ...understanding.values };
  const skippedNow =
    understanding.skip && state.current !== undefined && sheet[state.current] === undefined
      ? [state.current]
      : [];
  const skipped = [...state.skipped.filter((key) => sheet[key] === undefined), ...skippedNow];
  return { sheet, skipped };
}

function openingFor(
  state: InterviewState,
  understanding: Understanding,
  skipped: readonly FieldName[],
): string {
  if (skipped.length > state.skipped.length) {
    return "わかりました、飛ばしますね。";
  }
  return Object.keys(understanding.values).length > 0
    ? thanks
    : "すみません、うまく受け取れませんでした。";
}

function afterAnswer(state: InterviewState, understanding: Understanding): InterviewState {
  const progress = { messages: state.messages, ...merged(state, understanding) };
  if (understanding.finish) {
    return summarizing(progress, "わかりました、ここまでにしますね。");
  }
  const next = nextField(progress.sheet, progress.skipped);
  if (next === undefined) {
    return summarizing(progress, thanks);
  }
  const { ask, message, reply } = understanding;
  const asked =
    ask === next && message !== undefined
      ? { text: message, ...(reply === undefined ? {} : { reply }) }
      : cannedQuestion(next, openingFor(state, understanding, progress.skipped));
  return asking(progress, next, asked);
}

function afterCorrection(state: InterviewState, understanding: Understanding): InterviewState {
  if (Object.keys(understanding.values).length === 0) {
    const text = "どの項目をどう直すかを、「職種は〇〇」のように教えてください。";
    return { ...state, messages: says(state, { role: "interviewer", text }) };
  }
  return summarizing({ messages: state.messages, ...merged(state, understanding) }, "直しました。");
}

function advance(
  state: InterviewState,
  utterance: MemberUtterance,
  understood?: Understanding,
): InterviewState {
  const understanding = interpret(state, utterance, understood);
  const heard = { ...state, messages: says(state, { role: "member", text: spoken(utterance) }) };
  return state.phase === "asking"
    ? afterAnswer(heard, understanding)
    : afterCorrection(heard, understanding);
}

function save(state: InterviewState): InterviewState {
  const text = "保存しました。";
  return { ...state, messages: says(state, { role: "interviewer", text }), phase: "saved" };
}

export { accepts, advance, begin, needsModel, save, spoken };
