import { Field as FieldPrimitive } from "@base-ui/react/field";

import { Checkbox } from "./checkbox";
import { labelClassName } from "./control";

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
    <FieldPrimitive.Root data-slot="field" className="flex w-fit items-center gap-2">
      <Checkbox
        aria-label={ariaLabel ?? label}
        checked={checked}
        disabled={disabled}
        name={name}
        onCheckedChange={onCheckedChange}
      />
      <FieldPrimitive.Label className={`cursor-pointer ${labelClassName}`}>
        {label}
      </FieldPrimitive.Label>
    </FieldPrimitive.Root>
  );
};

export { CheckboxField };
