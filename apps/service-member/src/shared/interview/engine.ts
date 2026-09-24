import { fieldDefinitions, fieldKeys, maximumInterests, readValue } from "./sheet.ts";
import { understandByRules } from "./understanding.ts";

import type { FieldName, ReplyForm, SheetData } from "./sheet.ts";
import type { InterviewState, MemberUtterance } from "./state.ts";
import type { UnderstandingData } from "./understanding.ts";

const maximumMessages = 100;
const thanks = "ありがとうございます。";
const summaryText =
  "ここまでの内容をまとめました。直したいところがあれば、そのまま教えてください。";

interface Asked {
  readonly reply?: ReplyForm;
  readonly text: string;
}

type Asking = Extract<InterviewState, { readonly phase: "asking" }>;
type Settled = Exclude<InterviewState, Asking>;
type Progress = Pick<InterviewState, "messages" | "sheet" | "skipped">;
type Message = InterviewState["messages"][number];

function nextField(sheet: SheetData, skipped: readonly FieldName[]): FieldName | undefined {
  const skippedFields = new Set(skipped);
  return fieldKeys.find((key) => sheet[key] === undefined && !skippedFields.has(key));
}

function cannedQuestion(key: FieldName, opening: string): Asked {
  const { question, reply } = fieldDefinitions[key];
  return { text: `${opening}${question}`, ...(reply === undefined ? {} : { reply }) };
}

function says(progress: Progress, message: Message): InterviewState["messages"] {
  return [...progress.messages, message].slice(-maximumMessages);
}

function asking(progress: Progress, key: FieldName, asked: Asked): Asking {
  return {
    current: key,
    messages: says(progress, { role: "interviewer", text: asked.text }),
    phase: "asking",
    sheet: progress.sheet,
    skipped: progress.skipped,
    ...(asked.reply === undefined ? {} : { reply: asked.reply }),
  };
}

function summarizing(progress: Progress, opening: string): Settled {
  const { sheet, skipped } = progress;
  const text = `${opening}${summaryText}`;
  return {
    messages: says(progress, { card: { sheet, skipped }, role: "interviewer", text }),
    phase: "summary",
    sheet,
    skipped,
  };
}

function begin(): Asking {
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

function offered(reply: ReplyForm | undefined, values: readonly string[]): boolean {
  if (reply === undefined || reply.kind === "confirm") {
    return false;
  }
  const limit = reply.kind === "multiple" ? maximumInterests : 1;
  const options = new Set(reply.options);
  return (
    values.length <= limit &&
    new Set(values).size === values.length &&
    values.every((value) => options.has(value))
  );
}

function accepts(state: InterviewState, utterance: MemberUtterance): boolean {
  if (utterance.kind === "text") {
    return true;
  }
  return (
    state.phase === "asking" &&
    (utterance.kind !== "choice" || offered(state.reply, utterance.values))
  );
}

function needsModel(utterance: MemberUtterance): boolean {
  return utterance.kind === "text" || utterance.kind === "choice";
}

function interpret(
  state: InterviewState,
  utterance: MemberUtterance,
  understood: UnderstandingData | undefined,
): UnderstandingData {
  if (utterance.kind === "text") {
    if (understood === undefined) {
      return understandByRules(state, utterance.text);
    }
    return understood;
  }
  if (utterance.kind === "choice" && state.phase === "asking") {
    const values = readValue(state.current, utterance.values);
    return { ...understood, finish: false, skip: false, values };
  }
  return { finish: utterance.kind === "finish", skip: utterance.kind === "skip", values: {} };
}

function merged(
  state: InterviewState,
  understanding: UnderstandingData,
): Pick<InterviewState, "sheet" | "skipped"> {
  const sheet = { ...state.sheet, ...understanding.values };
  const skippedNow =
    understanding.skip && state.phase === "asking" && sheet[state.current] === undefined
      ? [state.current]
      : [];
  const skipped = [...state.skipped.filter((key) => sheet[key] === undefined), ...skippedNow];
  return { sheet, skipped };
}

function openingFor(
  state: Asking,
  understanding: UnderstandingData,
  skipped: readonly FieldName[],
): string {
  if (skipped.length > state.skipped.length) {
    return "わかりました、飛ばしますね。";
  }
  return Object.keys(understanding.values).length > 0
    ? thanks
    : "すみません、うまく受け取れませんでした。";
}

function modelQuestion(next: FieldName, understanding: UnderstandingData): Asked | undefined {
  const { ask, message, reply } = understanding;
  if (ask !== next || message === undefined) {
    return undefined;
  }
  const fits = reply !== undefined && (reply.kind !== "multiple" || next === "interests");
  return { text: message, ...(fits ? { reply } : {}) };
}

function afterAnswer(state: Asking, understanding: UnderstandingData): InterviewState {
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
}

function afterCorrection(state: Settled, understanding: UnderstandingData): Settled {
  if (Object.keys(understanding.values).length === 0) {
    const text = "どの項目をどう直すかを、「職種は〇〇」のように教えてください。";
    return { ...state, messages: says(state, { role: "interviewer", text }) };
  }
  return summarizing({ messages: state.messages, ...merged(state, understanding) }, "直しました。");
}

function advance(
  state: InterviewState,
  utterance: MemberUtterance,
  understood?: UnderstandingData,
): InterviewState {
  const understanding = interpret(state, utterance, understood);
  const messages = says(state, { role: "member", text: spoken(utterance) });
  return state.phase === "asking"
    ? afterAnswer({ ...state, messages }, understanding)
    : afterCorrection({ ...state, messages }, understanding);
}

function save(state: Settled): Settled {
  const text = "保存しました。";
  return { ...state, messages: says(state, { role: "interviewer", text }), phase: "saved" };
}

const historyConsentText =
  "保存しました。会話の履歴を残して、次からのレコメンドに使ってもよいですか？";

function requestHistoryConsent(state: Settled): Settled {
  return {
    ...state,
    messages: says(state, { role: "interviewer", text: historyConsentText }),
    phase: "history_consent",
  };
}

function clearConversation(state: Settled): Settled {
  const { sheet, skipped } = state;
  return {
    messages: [{ role: "interviewer", text: "保存しました。" }],
    phase: "saved",
    sheet,
    skipped,
  };
}

export {
  accepts,
  advance,
  begin,
  clearConversation,
  needsModel,
  requestHistoryConsent,
  save,
  spoken,
};
