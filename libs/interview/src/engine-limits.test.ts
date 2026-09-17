import { accepts, advance, begin } from "./engine.ts";
import { describe, expect, it } from "vite-plus/test";
import { viewOf } from "./contracts.ts";

describe("reply forms the sheet cannot hold", () => {
  const manyHobbies = ["音楽", "料理", "読書", "映画", "旅行", "登山"];

  it("more choices than the sheet keeps, and repeated choices, are refused", () => {
    expect.hasAssertions();
    const asked = advance(
      begin(),
      { kind: "text", text: "たろうです。エンジニアです" },
      {
        ask: "interests",
        finish: false,
        message: "興味は？",
        reply: { kind: "multiple", options: manyHobbies },
        skip: false,
        values: { nickname: "たろう", occupation: "エンジニア" },
      },
    );
    expect(accepts(asked, { kind: "choice", values: manyHobbies })).toBe(false);
    expect(accepts(asked, { kind: "choice", values: ["音楽", "音楽"] })).toBe(false);
    expect(accepts(asked, { kind: "choice", values: manyHobbies.slice(1) })).toBe(true);
  });

  it("a multiple-choice form on a single-valued field is dropped and the question is kept", () => {
    expect.hasAssertions();
    const asked = advance(
      begin(),
      { kind: "text", text: "たろうです" },
      {
        ask: "occupation",
        finish: false,
        message: "お仕事は？",
        reply: { kind: "multiple", options: ["営業", "学生"] },
        skip: false,
        values: { nickname: "たろう" },
      },
    );
    const { messages, reply } = viewOf(asked);
    expect(messages.at(-1)).toStrictEqual({ role: "interviewer", text: "お仕事は？" });
    expect(reply).toBeUndefined();
  });
});

describe("words that only sound like a request", () => {
  it("a plain 'fine' is taken as the answer, not as a request to finish", () => {
    expect.hasAssertions();
    const view = viewOf(advance(begin(), { kind: "text", text: "いいです" }));
    expect(view.phase).toBe("asking");
    expect(view.fields[0]).toStrictEqual({
      key: "nickname",
      label: "呼び名",
      status: "answered",
      value: "いいです",
    });
  });
});

describe("earlier summary cards", () => {
  it("a card keeps what the sheet looked like when it was shown", () => {
    expect.hasAssertions();
    const skipped = advance(begin(), { kind: "skip" });
    const finished = advance(skipped, { kind: "finish" });
    const corrected = viewOf(advance(finished, { kind: "text", text: "呼び名はたろう" }));
    const nicknames = corrected.messages.map(({ card }) => card?.[0]);
    expect(nicknames).toStrictEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      { key: "nickname", label: "呼び名", status: "skipped" },
      undefined,
      { key: "nickname", label: "呼び名", status: "answered", value: "たろう" },
    ]);
  });
});
