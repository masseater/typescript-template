import type { FieldValidationMessages } from "@repo/ui";

const fieldValidationMessages = {
  patternMismatch: "指定された形式で入力してください。",
  tooLong: "文字数が多すぎます。",
  tooShort: "文字数が足りません。",
  typeMismatch: "正しい形式で入力してください。",
  valueMissing: "入力してください。",
} as const satisfies FieldValidationMessages;

export { fieldValidationMessages };
