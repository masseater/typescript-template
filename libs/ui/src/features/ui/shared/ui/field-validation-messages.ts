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

const localizedFieldValidationMessages = <Locale>(
  catalog: Readonly<
    Record<
      | "field_pattern_mismatch"
      | "field_too_long"
      | "field_too_short"
      | "field_type_mismatch"
      | "field_value_missing",
      (inputs: Readonly<Record<string, never>>, options: Readonly<{ locale: Locale }>) => string
    >
  >,
  locale: Locale,
): FieldValidationMessages => ({
  patternMismatch: catalog.field_pattern_mismatch({}, { locale }),
  tooLong: catalog.field_too_long({}, { locale }),
  tooShort: catalog.field_too_short({}, { locale }),
  typeMismatch: catalog.field_type_mismatch({}, { locale }),
  valueMissing: catalog.field_value_missing({}, { locale }),
});

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
  localizedFieldValidationMessages,
  useFieldValidationMessages,
};
export type { FieldValidationMessages };
