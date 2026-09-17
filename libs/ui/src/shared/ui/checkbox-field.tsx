import { Checkbox } from "./checkbox";
import { Field as FieldPrimitive } from "@base-ui/react/field";
import type { ReactElement } from "react";
import { labelClassName } from "./control";

function CheckboxField({
  checked,
  label,
  onCheckedChange,
}: Readonly<{
  checked: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}>): ReactElement {
  return (
    <FieldPrimitive.Root data-slot="field" className="flex w-fit items-center gap-2">
      <Checkbox checked={checked} onCheckedChange={onCheckedChange} />
      <FieldPrimitive.Label className={`cursor-pointer ${labelClassName}`}>
        {label}
      </FieldPrimitive.Label>
    </FieldPrimitive.Root>
  );
}

export { CheckboxField };
