import { expect, fn, userEvent } from "storybook/test";
import { CheckboxField } from "./checkbox-field";
import preview from "../../../.storybook/preview";

const meta = preview.meta({
  args: { label: "バックアップコードを保管しました", onCheckedChange: fn() },
  component: CheckboxField,
});

const Unchecked = meta.story({ args: { checked: false } });

const Checked = meta.story({ args: { checked: true } });

const Toggles = meta.story({
  args: { checked: false },
  play: async ({ args, canvas }) => {
    await userEvent.click(canvas.getByRole("checkbox"));
    await expect(args.onCheckedChange).toHaveBeenCalledWith(true, expect.anything());
  },
});

export { Checked, Toggles, Unchecked };
