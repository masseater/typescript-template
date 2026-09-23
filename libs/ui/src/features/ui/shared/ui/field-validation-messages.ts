import { createContext, use } from "react";

const fieldValidationMessageKinds = [
  "valueMissing",
  "typeMismatch",
  "patternMismatch",
  "tooShort",
  "tooLong",
] as const;

type FieldValidationMessages = Readonly<
  Record<(typeof fieldValidationMessageKinds)[number], string>
>;

const japaneseFieldValidationMessages = {
  patternMismatch: "指定された形式で入力してください。",
  tooLong: "文字数が多すぎます。",
  tooShort: "文字数が足りません。",
  typeMismatch: "正しい形式で入力してください。",
  valueMissing: "入力してください。",
} as const satisfies FieldValidationMessages;

const FieldValidationMessageContext = createContext<FieldValidationMessages | undefined>(undefined);

const useFieldValidationMessages = (): FieldValidationMessages => {
  const validationMessages = use(FieldValidationMessageContext);
  if (validationMessages === undefined) {
    throw new Error("Field validation messages are missing.");
  }
  return validationMessages;
};

export {
  FieldValidationMessageContext,
  fieldValidationMessageKinds,
  japaneseFieldValidationMessages,
  useFieldValidationMessages,
};
export type { FieldValidationMessages };
