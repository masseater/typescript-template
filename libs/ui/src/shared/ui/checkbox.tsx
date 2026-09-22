import { Checkbox as BaseCheckbox } from "baseui/checkbox";

import type { ReactElement } from "react";

const Checkbox = ({
  "aria-label": ariaLabel,
  checked,
  disabled = false,
  name,
  onCheckedChange,
}: Readonly<{
  "aria-label": string;
  checked: boolean;
  disabled?: boolean;
  name?: string | undefined;
  onCheckedChange: (checked: boolean) => void;
}>): ReactElement => {
  if (name === undefined) {
    return (
      <BaseCheckbox
        data-slot="checkbox"
        aria-label={ariaLabel}
        checked={checked}
        disabled={disabled}
        onChange={(change) => {
          onCheckedChange(change.currentTarget.checked);
        }}
      />
    );
  }
  return (
    <BaseCheckbox
      data-slot="checkbox"
      aria-label={ariaLabel}
      checked={checked}
      disabled={disabled}
      name={name}
      onChange={(change) => {
        onCheckedChange(change.currentTarget.checked);
      }}
    />
  );
};

export { Checkbox };
