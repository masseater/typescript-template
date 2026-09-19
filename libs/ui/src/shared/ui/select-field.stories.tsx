import { expect, fn, userEvent } from "storybook/test";

import preview from "../../../storybook/preview";
import { SelectField } from "./select-field";

const changeRole = fn<(value: string) => void>();

const meta = preview.meta({
  args: {
    label: "権限",
    name: "role",
    onValueChange: changeRole,
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
  play: async ({ canvas }) => {
    await userEvent.selectOptions(canvas.getByLabelText("権限"), "admin");
    await expect(changeRole.mock.calls.at(0)?.at(0)).toBe("admin");
  },
});
