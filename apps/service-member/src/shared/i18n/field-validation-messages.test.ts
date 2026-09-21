import { describe, expect, test } from "vite-plus/test";

import { fieldValidationMessages } from "./field-validation-messages.ts";

describe("field validation messages", () => {
  const it = test
    .extend("theJapaneseMessages", () => fieldValidationMessages("ja"))
    .extend("theEnglishMessages", () => fieldValidationMessages("en"));

  it("keeps the Japanese copy for every validation message", ({ theJapaneseMessages }) => {
    expect.hasAssertions();
    expect(theJapaneseMessages).toStrictEqual({
      patternMismatch: "指定された形式で入力してください。",
      tooLong: "文字数が多すぎます。",
      tooShort: "文字数が足りません。",
      typeMismatch: "正しい形式で入力してください。",
      valueMissing: "入力してください。",
    });
  });

  it("switches every validation message for an English session", ({ theEnglishMessages }) => {
    expect.hasAssertions();
    expect(theEnglishMessages).toStrictEqual({
      patternMismatch: "Follow the requested format.",
      tooLong: "Too many characters.",
      tooShort: "Not enough characters.",
      typeMismatch: "Enter a valid format.",
      valueMissing: "Enter a value.",
    });
  });
});
