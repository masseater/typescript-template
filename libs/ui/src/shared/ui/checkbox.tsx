import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { CheckIcon } from "lucide-react";

import type { ReactElement } from "react";

const indicator = (
  <CheckboxPrimitive.Indicator
    data-slot="checkbox-indicator"
    className="grid place-content-center text-current [&>svg]:size-3"
  >
    <CheckIcon />
  </CheckboxPrimitive.Indicator>
);

const Checkbox = ({
  "aria-label": ariaLabel,
  checked,
  onCheckedChange,
}: Readonly<{
  "aria-label": string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}>): ReactElement => {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      aria-label={ariaLabel}
      checked={checked}
      onCheckedChange={onCheckedChange}
      className="box-border flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-input bg-card outline-none focus-visible:focus-indicator-outer disabled:cursor-not-allowed disabled:border-border/50 disabled:bg-card-hover data-invalid:border-destructive data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground"
    >
      {indicator}
    </CheckboxPrimitive.Root>
  );
};

export { Checkbox };
