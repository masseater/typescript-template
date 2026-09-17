import type { ComponentProps, ReactElement } from "react";
import { controlClassName, errorClassName, fieldClassName, labelClassName } from "./control";
import { Field as FieldPrimitive } from "@base-ui/react/field";

type TextareaFieldProps = Readonly<
  Pick<
    ComponentProps<"input">,
    "maxLength" | "name" | "onChange" | "readOnly" | "required" | "value"
  > & { label: string }
>;

const textarea = <textarea />;

function TextareaField({
  label,
  maxLength,
  name,
  onChange,
  readOnly,
  required,
  value,
}: TextareaFieldProps): ReactElement {
  return (
    <FieldPrimitive.Root data-slot="field" name={name} className={fieldClassName}>
      <FieldPrimitive.Label className={labelClassName}>{label}</FieldPrimitive.Label>
      <FieldPrimitive.Control
        render={textarea}
        name={name}
        value={value}
        maxLength={maxLength}
        readOnly={readOnly}
        required={required}
        onChange={onChange}
        className={`block field-sizing-content min-h-16 ${controlClassName}`}
      />
      <FieldPrimitive.Error className={errorClassName} />
    </FieldPrimitive.Root>
  );
}

export { TextareaField };
