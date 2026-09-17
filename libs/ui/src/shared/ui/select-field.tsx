import { controlClassName, fieldClassName, labelClassName } from "./control";
import { useCallback, useId } from "react";
import type { ReactElement } from "react";

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
  const id = useId();
  const handleChange = useCallback(
    (event: Readonly<{ currentTarget: Readonly<Pick<HTMLSelectElement, "value">> }>) => {
      onValueChange(event.currentTarget.value);
    },
    [onValueChange],
  );
  return (
    <div data-slot="field" className={fieldClassName}>
      <label htmlFor={id} className={labelClassName}>
        {label}
      </label>
      <select
        id={id}
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
    </div>
  );
}

export { SelectField };
