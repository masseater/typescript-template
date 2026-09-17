import { expect, fn, userEvent } from "storybook/test";
import { SelectField } from "./select-field";
import preview from "../../../.storybook/preview";

const meta = preview.meta({
  args: {
    label: "権限",
    name: "role",
    onValueChange: fn(),
    options: [
      { label: "一般", value: "user" },
      { label: "管理者", value: "admin" },
    ],
    value: "user",
  },
  component: SelectField,
});

const Default = meta.story();

const Admin = meta.story({ args: { value: "admin" } });

const Selects = meta.story({
  play: async ({ args, canvas }) => {
    await userEvent.selectOptions(canvas.getByLabelText("権限"), "admin");
    await expect(args.onValueChange).toHaveBeenCalledWith("admin");
  },
});

export { Admin, Default, Selects };
