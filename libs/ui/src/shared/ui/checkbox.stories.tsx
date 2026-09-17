import { Checkbox } from "./checkbox";
import { noop } from "es-toolkit";
import preview from "../../../.storybook/preview";

const meta = preview.meta({
  args: { "aria-label": "通知を受け取る", onCheckedChange: noop },
  component: Checkbox,
});

export const Unchecked = meta.story({ args: { checked: false } });

export const Checked = meta.story({ args: { checked: true } });
