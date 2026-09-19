import { Field as FieldPrimitive } from "@base-ui/react/field";

import { controlClassName, errorClassName, fieldClassName, labelClassName } from "./control";

import type { ComponentProps, ReactElement } from "react";

const validationMessages: readonly (readonly [keyof ValidityState, string])[] = [
  ["valueMissing", "入力してください。"],
  ["typeMismatch", "正しい形式で入力してください。"],
  ["patternMismatch", "指定された形式で入力してください。"],
  ["tooShort", "文字数が足りません。"],
  ["tooLong", "文字数が多すぎます。"],
];

const validationErrorElements = validationMessages.map(([match, validationMessage]) => (
  <FieldPrimitive.Error key={match} match={match} className={errorClassName}>
    {validationMessage}
  </FieldPrimitive.Error>
));

const Field = ({
  autoComplete,
  inputMode,
  label,
  maxLength,
  minLength,
  multiline,
  name,
  onValueChange,
  pattern,
  readOnly,
  required,
  type,
  value,
}: Readonly<
  Pick<
    ComponentProps<"input">,
    "inputMode" | "maxLength" | "minLength" | "name" | "readOnly" | "required" | "value"
  > & {
    autoComplete?:
      | "current-password"
      | "name"
      | "new-password"
      | "off"
      | "one-time-code"
      | "username";
    label: string;
    onValueChange?: (value: string) => void;
  }
> &
  Readonly<
    | { multiline: true; pattern?: never; type?: never }
    | { multiline?: false; pattern?: string; type?: "email" | "password" | "search" | "text" }
  >): ReactElement => {
  return (
    <FieldPrimitive.Root data-slot="field" validationMode="onBlur" className={fieldClassName}>
      <FieldPrimitive.Label className={labelClassName}>{label}</FieldPrimitive.Label>
      <FieldPrimitive.Control
        render={multiline === true ? <textarea aria-label={label} /> : undefined}
        type={type}
        name={name}
        value={value}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        minLength={minLength}
        pattern={pattern}
        readOnly={readOnly}
        required={required}
        onValueChange={onValueChange}
        className={`${multiline === true ? "block field-sizing-content min-h-16" : "inline-block leading-none"} ${controlClassName}`}
      />
      {validationErrorElements}
    </FieldPrimitive.Root>
  );
};

export { Field };
