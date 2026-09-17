import { controlClassName, fieldClassName, labelClassName } from "./control";
import { FieldErrors } from "./field-errors";
import { Field as FieldPrimitive } from "@base-ui/react/field";
import type { ReactElement } from "react";

// oxlint-disable-next-line jsx-a11y/control-has-associated-label
const select = <select />;

function SelectField({
  label,
  name,
  onValueChange,
  options,
  required,
  value,
}: Readonly<{
  label: string;
  name: string;
  onValueChange: (value: string) => void;
  options: readonly Readonly<{ label: string; value: string }>[];
  required?: boolean;
  value: string;
}>): ReactElement {
  return (
    <FieldPrimitive.Root data-slot="field" validationMode="onBlur" className={fieldClassName}>
      <FieldPrimitive.Label className={labelClassName}>{label}</FieldPrimitive.Label>
      <FieldPrimitive.Control
        render={select}
        name={name}
        value={value}
        required={required}
        onValueChange={onValueChange}
        className={`inline-block leading-none ${controlClassName}`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </FieldPrimitive.Control>
      <FieldErrors />
    </FieldPrimitive.Root>
  );
}

export { SelectField };
