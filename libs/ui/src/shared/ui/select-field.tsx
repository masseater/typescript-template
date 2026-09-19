import { Field as FieldPrimitive } from "@base-ui/react/field";

import { controlClassName, fieldClassName, labelClassName } from "./control";

import type { ReactElement } from "react";

const SelectField = ({
  label,
  name,
  onValueChange,
  options,
  value,
}: Readonly<{
  label: string;
  name: string;
  onValueChange: (value: string) => void;
  options: readonly Readonly<{ label: string; value: string }>[];
  value: string;
}>): ReactElement => {
  const select = (
    <select aria-label={label}>
      {options.map((selectOption) => (
        <option key={selectOption.value} value={selectOption.value}>
          {selectOption.label}
        </option>
      ))}
    </select>
  );
  return (
    <FieldPrimitive.Root data-slot="field" validationMode="onBlur" className={fieldClassName}>
      <FieldPrimitive.Label className={labelClassName}>{label}</FieldPrimitive.Label>
      <FieldPrimitive.Control
        render={select}
        name={name}
        value={value}
        onValueChange={onValueChange}
        className={`inline-block leading-none ${controlClassName}`}
      />
    </FieldPrimitive.Root>
  );
};

export { SelectField };
