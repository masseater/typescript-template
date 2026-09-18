import type { ComponentProps, ReactElement } from "react";
import { Field } from "./shared/ui/field";
import type { TextFieldApi } from "./form";
import { fieldError } from "./form";

type FieldProps = ComponentProps<typeof Field>;

function FormTextField({
  autoComplete,
  field,
  inputMode,
  label,
  maxLength,
  minLength,
  name,
  pattern,
  required,
  type,
}: Readonly<
  Pick<
    FieldProps,
    "autoComplete" | "inputMode" | "label" | "maxLength" | "minLength" | "name" | "required"
  > & {
    field: TextFieldApi;
    pattern?: string;
    type?: "email" | "password" | "search" | "text";
  }
>): ReactElement {
  return (
    <Field
      label={label}
      name={name}
      type={type}
      autoComplete={autoComplete}
      inputMode={inputMode}
      maxLength={maxLength}
      minLength={minLength}
      pattern={pattern}
      required={required}
      value={field.state.value}
      error={fieldError(field.state.meta.errors)}
      onValueChange={field.handleChange}
    />
  );
}

export { FormTextField };
