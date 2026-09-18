import { assert, describe, expect, it } from "vite-plus/test";

import { viewOf } from "./contracts.ts";
import { accepts, advance, begin, save } from "./engine.ts";

const NICKNAME_LIMIT = 30;
const OCCUPATION_INDEX = 1;
const AREA_INDEX = 3;
const greeting = "はじめまして。なんて呼べばいいですか？";
const summary = "ここまでの内容をまとめました。直したいところがあれば、そのまま教えてください。";
const occupationChoices = { kind: "single", options: ["エンジニア", "デザイナー", "営業", "学生"] };

describe("an interview answered with the reply forms", () => {
  it("every question answered in order ends with a summary card of the whole sheet", () => {
    expect.hasAssertions();
    const named = advance(begin(), { kind: "text", text: "たろう" });
    const employed = advance(named, { kind: "choice", values: ["エンジニア"] });
    const interested = advance(employed, { kind: "choice", values: ["音楽", "料理"] });
    const located = advance(interested, { kind: "choice", values: ["東京"] });
    const finished = advance(located, { kind: "text", text: "よろしく" });
    const fields = [
      { key: "nickname", label: "呼び名", status: "answered", value: "たろう" },
      { key: "occupation", label: "職種", status: "answered", value: "エンジニア" },
      { key: "interests", label: "興味", status: "answered", value: "音楽、料理" },
      { key: "area", label: "活動エリア", status: "answered", value: "東京" },
      { key: "message", label: "ひとこと", status: "answered", value: "よろしく" },
    ];
    const thanks = "ありがとうございます。";
    expect(viewOf(finished)).toStrictEqual({
      fields,
      messages: [
        { role: "interviewer", text: greeting },
        { role: "member", text: "たろう" },
        { role: "interviewer", text: `${thanks}ふだんはどんなお仕事をしていますか？` },
        { role: "member", text: "エンジニア" },
        {
          role: "interviewer",
          text: `${thanks}興味のあるものを教えてください。いくつでも選べます。`,
        },
        { role: "member", text: "音楽、料理" },
        { role: "interviewer", text: `${thanks}主にどのあたりで活動していますか？` },
        { role: "member", text: "東京" },
        { role: "interviewer", text: `${thanks}最後に、載せたいひとことをどうぞ。` },
        { role: "member", text: "よろしく" },
        { card: fields, role: "interviewer", text: `${thanks}${summary}` },
      ],
      phase: "summary",
    });
  });
});

describe("reply forms", () => {
  it("the question after the nickname offers the occupation choices", () => {
    expect.hasAssertions();
    const named = advance(begin(), { kind: "text", text: "たろう" });
    expect(viewOf(named).reply).toStrictEqual(occupationChoices);
  });

  it("only choices that the current reply form offers are accepted", () => {
    expect.hasAssertions();
    const named = advance(begin(), { kind: "text", text: "たろう" });
    expect(accepts(named, { kind: "choice", values: ["エンジニア"] })).toBe(true);
    expect(accepts(named, { kind: "choice", values: ["医師"] })).toBe(false);
    expect(accepts(named, { kind: "choice", values: ["エンジニア", "営業"] })).toBe(false);
    expect(accepts(begin(), { kind: "choice", values: ["エンジニア"] })).toBe(false);
  });
});

describe("an utterance that ignores the question", () => {
  it("an utterance fills every field the model read from it and the model asks the next one", () => {
    expect.hasAssertions();
    const message = "東京のエンジニアさんなんですね。なんて呼べばいいですか？";
    const next = advance(
      begin(),
      { kind: "text", text: "東京でエンジニアやってます" },
      {
        ask: "nickname",
        finish: false,
        message,
        skip: false,
        values: { area: "東京", occupation: "エンジニア" },
      },
    );
    expect(viewOf(next)).toStrictEqual({
      fields: [
        { key: "nickname", label: "呼び名", status: "unanswered" },
        { key: "occupation", label: "職種", status: "answered", value: "エンジニア" },
        { key: "interests", label: "興味", status: "unanswered" },
        { key: "area", label: "活動エリア", status: "answered", value: "東京" },
        { key: "message", label: "ひとこと", status: "unanswered" },
      ],
      messages: [
        { role: "interviewer", text: greeting },
        { role: "member", text: "東京でエンジニアやってます" },
        { role: "interviewer", text: message },
      ],
      phase: "asking",
    });
  });
});

describe("what the model understood", () => {
  it("a model question about a field that is not next is replaced with the scripted question", () => {
    expect.hasAssertions();
    const next = advance(
      begin(),
      { kind: "text", text: "たろうです" },
      {
        ask: "area",
        finish: false,
        message: "どこに住んでいますか？",
        reply: { kind: "confirm" },
        skip: false,
        values: { nickname: "たろう" },
      },
    );
    const { messages, reply } = viewOf(next);
    expect(messages.at(-1)).toStrictEqual({
      role: "interviewer",
      text: "ありがとうございます。ふだんはどんなお仕事をしていますか？",
    });
    expect(reply).toStrictEqual(occupationChoices);
  });

  it("a restated field overwrites the earlier answer", () => {
    expect.hasAssertions();
    const named = advance(begin(), { kind: "text", text: "たろう" });
    const restated = advance(
      named,
      { kind: "text", text: "やっぱりジロウと呼んでください。仕事は営業です" },
      { finish: false, skip: false, values: { nickname: "ジロウ", occupation: "営業" } },
    );
    expect(viewOf(restated).fields.slice(0, OCCUPATION_INDEX + 1)).toStrictEqual([
      { key: "nickname", label: "呼び名", status: "answered", value: "ジロウ" },
      { key: "occupation", label: "職種", status: "answered", value: "営業" },
    ]);
  });
});

describe("answers outside the sheet's limits", () => {
  it("an answer longer than the field allows is not stored and the same field is asked again", () => {
    expect.hasAssertions();
    const next = advance(begin(), { kind: "text", text: "あ".repeat(NICKNAME_LIMIT + 1) });
    const view = viewOf(next);
    expect(view.fields[0]).toStrictEqual({
      key: "nickname",
      label: "呼び名",
      status: "unanswered",
    });
    expect(view.messages.at(-1)).toStrictEqual({
      role: "interviewer",
      text: "すみません、うまく受け取れませんでした。なんて呼べばいいですか？",
    });
  });
});

describe("skipping", () => {
  it("a skipped field is marked, never asked again, and the next field is asked", () => {
    expect.hasAssertions();
    const view = viewOf(advance(begin(), { kind: "skip" }));
    expect(view.fields[0]).toStrictEqual({ key: "nickname", label: "呼び名", status: "skipped" });
    expect(view.messages.slice(1)).toStrictEqual([
      { role: "member", text: "スキップ" },
      {
        role: "interviewer",
        text: "わかりました、飛ばしますね。ふだんはどんなお仕事をしていますか？",
      },
    ]);
  });

  it("a skip request in plain words skips the current field without the model", () => {
    expect.hasAssertions();
    const view = viewOf(advance(begin(), { kind: "text", text: "パスで" }));
    expect(view.fields[0]).toStrictEqual({ key: "nickname", label: "呼び名", status: "skipped" });
  });

  it("a nickname that merely starts like a skip word is stored as the answer", () => {
    expect.hasAssertions();
    const view = viewOf(advance(begin(), { kind: "text", text: "パスタ" }));
    expect(view.fields[0]).toStrictEqual({
      key: "nickname",
      label: "呼び名",
      status: "answered",
      value: "パスタ",
    });
  });
});

describe("finishing early", () => {
  it("finishing early summarizes at once and leaves the rest unanswered", () => {
    expect.hasAssertions();
    const skipped = advance(begin(), { kind: "skip" });
    const view = viewOf(advance(skipped, { kind: "text", text: "もう終わりで" }));
    const fields = [
      { key: "nickname", label: "呼び名", status: "skipped" },
      { key: "occupation", label: "職種", status: "unanswered" },
      { key: "interests", label: "興味", status: "unanswered" },
      { key: "area", label: "活動エリア", status: "unanswered" },
      { key: "message", label: "ひとこと", status: "unanswered" },
    ];
    expect(view.phase).toBe("summary");
    expect(view.fields).toStrictEqual(fields);
    expect(view.messages.at(-1)).toStrictEqual({
      card: fields,
      role: "interviewer",
      text: `わかりました、ここまでにしますね。${summary}`,
    });
  });

  it("a finish request keeps what the same utterance answered", () => {
    expect.hasAssertions();
    const finished = advance(
      begin(),
      { kind: "text", text: "東京です。もう終わりにしたい" },
      { finish: true, skip: false, values: { area: "東京" } },
    );
    expect(viewOf(finished).phase).toBe("summary");
    expect(viewOf(finished).fields[AREA_INDEX]).toStrictEqual({
      key: "area",
      label: "活動エリア",
      status: "answered",
      value: "東京",
    });
  });
});

describe("after the questions are over", () => {
  it("skip, finish and choices are refused once the questions are over", () => {
    expect.hasAssertions();
    const finished = advance(begin(), { kind: "finish" });
    expect(accepts(finished, { kind: "skip" })).toBe(false);
    expect(accepts(finished, { kind: "finish" })).toBe(false);
    expect(accepts(finished, { kind: "text", text: "職種は営業" })).toBe(true);
  });

  it("a correction in plain words updates the sheet and shows a new card", () => {
    expect.hasAssertions();
    const finished = advance(begin(), { kind: "finish" });
    const view = viewOf(advance(finished, { kind: "text", text: "職種はデザイナーにして" }));
    const occupation = {
      key: "occupation",
      label: "職種",
      status: "answered",
      value: "デザイナー",
    };
    expect(view.phase).toBe("summary");
    expect(view.fields[OCCUPATION_INDEX]).toStrictEqual(occupation);
    expect(view.messages.at(-1)?.text).toBe(`直しました。${summary}`);
    expect(view.messages.at(-1)?.card?.[OCCUPATION_INDEX]).toStrictEqual(occupation);
  });
});

describe("corrections that change nothing or follow a save", () => {
  it("an utterance that names no field leaves the sheet and asks how to correct", () => {
    expect.hasAssertions();
    const finished = advance(begin(), { kind: "finish" });
    const puzzled = viewOf(advance(finished, { kind: "text", text: "うーん" }));
    expect(puzzled.phase).toBe("summary");
    expect(puzzled.fields.map(({ status }) => status)).toStrictEqual([
      "unanswered",
      "unanswered",
      "unanswered",
      "unanswered",
      "unanswered",
    ]);
    expect(puzzled.messages.at(-1)).toStrictEqual({
      role: "interviewer",
      text: "どの項目をどう直すかを、「職種は〇〇」のように教えてください。",
    });
  });

  it("a correction after saving returns to the summary so that it can be saved again", () => {
    expect.hasAssertions();
    const finished = advance(begin(), { kind: "finish" });
    assert(finished.phase === "summary");
    const saved = save(finished);
    expect(viewOf(saved).phase).toBe("saved");
    expect(viewOf(saved).messages.at(-1)).toStrictEqual({
      role: "interviewer",
      text: "保存しました。",
    });
    const corrected = advance(saved, { kind: "text", text: "呼び名はたろう" });
    expect(viewOf(corrected).phase).toBe("summary");
  });
});
