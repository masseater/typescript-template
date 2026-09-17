import { controlClassName, fieldClassName, labelClassName } from "./control";
import { Field as FieldPrimitive } from "@base-ui/react/field";
import type { ReactElement } from "react";
import { useCallback } from "react";

interface SelectFieldProps {
  readonly label: string;
  readonly name: string;
  readonly onValueChange: (value: string) => void;
  readonly options: readonly Readonly<{ label: string; value: string }>[];
  readonly value: string;
}

function SelectField({
  label,
  name,
  onValueChange,
  options,
  value,
}: SelectFieldProps): ReactElement {
  const handleChange = useCallback(
    (event: Readonly<{ currentTarget: Readonly<Pick<HTMLSelectElement, "value">> }>) => {
      onValueChange(event.currentTarget.value);
    },
    [onValueChange],
  );
  return (
    <FieldPrimitive.Root data-slot="field" className={fieldClassName}>
      <FieldPrimitive.Label className={labelClassName}>{label}</FieldPrimitive.Label>
      <select
        data-slot="select"
        name={name}
        value={value}
        onChange={handleChange}
        className={`inline-block leading-none ${controlClassName}`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldPrimitive.Root>
  );
}

export { SelectField };
