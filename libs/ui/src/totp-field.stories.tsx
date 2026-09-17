import { TotpField } from "./totp-field";
import { noop } from "es-toolkit";
import preview from "../.storybook/preview";

const meta = preview.meta({
  args: { code: { handleChange: noop, value: "" } },
  component: TotpField,
});

export const Empty = meta.story();

export const Filled = meta.story({ args: { code: { handleChange: noop, value: "123456" } } });
