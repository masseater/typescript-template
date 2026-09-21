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
    throw new Error("FIELD_VALIDATION_MESSAGES_MISSING");
  }
  return validationMessages;
};

export { FieldValidationMessageContext, fieldValidationMessageKinds, useFieldValidationMessages };
export type { FieldValidationMessages };
