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

const FieldValidationMessageContext = createContext<FieldValidationMessages | undefined>(undefined);

const useFieldValidationMessages = (): FieldValidationMessages => {
  const validationMessages = use(FieldValidationMessageContext);
  if (validationMessages === undefined) {
    throw new Error("Field validation messages are missing.");
  }
  return validationMessages;
};

export { FieldValidationMessageContext, fieldValidationMessageKinds, useFieldValidationMessages };
export type { FieldValidationMessages };
