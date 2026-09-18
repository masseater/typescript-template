import { TotpField } from "./totp-field";
import { noop } from "es-toolkit";
import preview from "../.storybook/preview";

const meta = preview.meta({
  args: { field: { handleChange: noop, state: { meta: { errors: [] }, value: "" } } },
  component: TotpField,
});

export const Empty = meta.story();

export const Filled = meta.story({
  args: { field: { handleChange: noop, state: { meta: { errors: [] }, value: "123456" } } },
});
