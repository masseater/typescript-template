import preview from "../../../storybook/preview";
import { TotpField } from "./totp-field";

const meta = preview.meta({
  args: { code: { handleChange: () => undefined, value: "" } },
  component: TotpField,
});

export const Empty = meta.story();

export const Filled = meta.story({
  args: { code: { handleChange: () => undefined, value: "123456" } },
});
