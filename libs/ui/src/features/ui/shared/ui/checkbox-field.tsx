import { Checkbox } from "./checkbox";

import type { ReactElement } from "react";

const CheckboxField = ({
  "aria-label": ariaLabel,
  checked,
  disabled = false,
  label,
  name,
  onCheckedChange,
}: Readonly<{
  "aria-label"?: string;
  checked: boolean;
  disabled?: boolean;
  label: string;
  name?: string | undefined;
  onCheckedChange: (checked: boolean) => void;
}>): ReactElement => {
  return (
    <label data-slot="field" className="flex w-fit cursor-pointer items-center gap-2">
      <Checkbox
        aria-label={ariaLabel ?? label}
        checked={checked}
        disabled={disabled}
        name={name}
        onCheckedChange={onCheckedChange}
      />
      <span className="text-base leading-none font-bold text-foreground">{label}</span>
    </label>
  );
};

export { CheckboxField };
