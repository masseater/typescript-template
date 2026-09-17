import { expect, fn, userEvent } from "storybook/test";
import { SelectField } from "./select-field";
import { noop } from "es-toolkit";
import preview from "../../../.storybook/preview";

const meta = preview.meta({
  args: {
    label: "権限",
    name: "role",
    onValueChange: noop,
    options: [
      { label: "一般", value: "user" },
      { label: "管理者", value: "admin" },
    ],
    value: "user",
  },
  component: SelectField,
});

export const Default = meta.story();

export const Admin = meta.story({ args: { value: "admin" } });

export const Selects = meta.story({
  args: { onValueChange: fn() },
  play: async ({ args, canvas }) => {
    await userEvent.selectOptions(canvas.getByLabelText("権限"), "admin");
    await expect(args.onValueChange).toHaveBeenCalledWith("admin", expect.anything());
  },
});
