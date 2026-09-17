import type { ComponentProps, ReactElement } from "react";
import { controlClassName, fieldClassName, labelClassName } from "./control";
import { FieldErrors } from "./field-errors";
import { Field as FieldPrimitive } from "@base-ui/react/field";

const textarea = <textarea />;

type AutoComplete =
  | "current-password"
  | "name"
  | "new-password"
  | "off"
  | "one-time-code"
  | "username";

function Field({
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
    autoComplete?: AutoComplete;
    label: string;
    onValueChange?: (value: string) => void;
  }
> &
  Readonly<
    | { multiline: true; pattern?: never; type?: never }
    | { multiline?: false; pattern?: string; type?: "email" | "password" | "search" | "text" }
  >): ReactElement {
  return (
    <FieldPrimitive.Root data-slot="field" validationMode="onBlur" className={fieldClassName}>
      <FieldPrimitive.Label className={labelClassName}>{label}</FieldPrimitive.Label>
      <FieldPrimitive.Control
        render={multiline === true ? textarea : undefined}
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
      <FieldErrors />
    </FieldPrimitive.Root>
  );
}

export { Field };
