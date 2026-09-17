import type { ComponentProps, ReactElement } from "react";
import { controlClassName, errorClassName, fieldClassName, labelClassName } from "./control";
import { Field as FieldPrimitive } from "@base-ui/react/field";

type FieldProps = Readonly<
  Pick<
    ComponentProps<"input">,
    | "autoComplete"
    | "inputMode"
    | "maxLength"
    | "minLength"
    | "name"
    | "onChange"
    | "pattern"
    | "readOnly"
    | "required"
    | "type"
    | "value"
  > & { label: string }
>;

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function Field({
  autoComplete,
  inputMode,
  label,
  maxLength,
  minLength,
  name,
  onChange,
  pattern,
  readOnly,
  required,
  type,
  value,
}: FieldProps): ReactElement {
  return (
    <FieldPrimitive.Root data-slot="field" validationMode="onBlur" className={fieldClassName}>
      <FieldPrimitive.Label className={labelClassName}>{label}</FieldPrimitive.Label>
      <FieldPrimitive.Control
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
        onChange={onChange}
        className={`inline-block leading-none ${controlClassName}`}
      />
      <FieldPrimitive.Error className={errorClassName} />
    </FieldPrimitive.Root>
  );
}

export { Field };
