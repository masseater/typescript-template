import { expect, fn, userEvent } from "storybook/test";
import { CheckboxField } from "./checkbox-field";
import { noop } from "es-toolkit";
import preview from "../../../.storybook/preview";

const meta = preview.meta({
  args: { label: "バックアップコードを保管しました", onCheckedChange: noop },
  component: CheckboxField,
});

export const Unchecked = meta.story({ args: { checked: false } });

export const Checked = meta.story({ args: { checked: true } });

export const Toggles = meta.story({
  args: { checked: false, onCheckedChange: fn() },
  play: async ({ args, canvas }) => {
    await userEvent.click(canvas.getByRole("checkbox"));
    await expect(args.onCheckedChange).toHaveBeenCalledWith(true, expect.anything());
  },
});
