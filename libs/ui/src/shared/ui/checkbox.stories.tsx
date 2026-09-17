import { Checkbox } from "./checkbox";
import { Field as FieldPrimitive } from "@base-ui/react/field";
import type { ReactElement } from "react";
import { fn } from "storybook/test";
import { labelClassName } from "./control";
import preview from "../../../.storybook/preview";

const meta = preview.meta({
  args: { onCheckedChange: fn() },
  component: Checkbox,
  render: ({ checked, onCheckedChange }): ReactElement => (
    <FieldPrimitive.Root className="flex w-fit items-center gap-2">
      <Checkbox checked={checked} onCheckedChange={onCheckedChange} />
      <FieldPrimitive.Label className={labelClassName}>通知を受け取る</FieldPrimitive.Label>
    </FieldPrimitive.Root>
  ),
});

const Unchecked = meta.story({ args: { checked: false } });

const Checked = meta.story({ args: { checked: true } });

export { Checked, Unchecked };
