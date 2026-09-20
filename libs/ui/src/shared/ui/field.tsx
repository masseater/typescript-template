import { Field as FieldPrimitive } from "@base-ui/react/field";

import { controlClassName, errorClassName, fieldClassName, labelClassName } from "./control";

import type { ComponentProps, ReactElement } from "react";

const Field = ({
  autoComplete,
  error,
  inputMode,
  label,
  maxLength,
  multiline,
  name,
  onBlur,
  onValueChange,
  readOnly,
  type,
  value,
}: Readonly<
  Pick<ComponentProps<"input">, "inputMode" | "maxLength" | "name" | "readOnly" | "value"> & {
    autoComplete?:
      | "current-password"
      | "name"
      | "new-password"
      | "off"
      | "one-time-code"
      | "username";
    error?: string | undefined;
    label: string;
    onBlur?: () => void;
    onValueChange?: (value: string) => void;
  }
> &
  Readonly<
    | { multiline: true; type?: never }
    | { multiline?: false; type?: "email" | "password" | "search" | "text" }
  >): ReactElement => {
  return (
    <FieldPrimitive.Root
      data-slot="field"
      invalid={error !== undefined}
      className={fieldClassName}
    >
      <FieldPrimitive.Label className={labelClassName}>{label}</FieldPrimitive.Label>
      <FieldPrimitive.Control
        render={multiline === true ? <textarea aria-label={label} /> : undefined}
        type={type}
        name={name}
        value={value}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        readOnly={readOnly}
        onBlur={onBlur}
        onValueChange={onValueChange}
        className={`${multiline === true ? "block field-sizing-content min-h-16" : "inline-block leading-none"} ${controlClassName}`}
      />
      {error === undefined ? undefined : (
        <FieldPrimitive.Error match className={errorClassName}>
          {error}
        </FieldPrimitive.Error>
      )}
    </FieldPrimitive.Root>
  );
};

export { Field };
