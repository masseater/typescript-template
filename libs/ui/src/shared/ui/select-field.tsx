import { FormControl } from "baseui/form-control";
import { Select, type Value as SelectValue } from "baseui/select";

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
  onValueChange: (selectedValue: string) => void;
  options: readonly Readonly<{ label: string; value: string }>[];
  value: string;
}>): ReactElement => {
  const match = options.find((choice) => choice.value === value);
  const selected: SelectValue =
    match === undefined ? [] : [{ id: match.value, label: match.label }];
  return (
    <FormControl label={label}>
      <Select
        aria-label={label}
        clearable={false}
        creatable={false}
        escapeClearsValue={false}
        id={name}
        options={options.map((choice) => ({ id: choice.value, label: choice.label }))}
        value={selected}
        onChange={(change) => {
          const selectedId = change.value[0]?.id;
          if (typeof selectedId === "string" || typeof selectedId === "number") {
            onValueChange(String(selectedId));
          }
        }}
      />
    </FormControl>
  );
};

export { SelectField };
