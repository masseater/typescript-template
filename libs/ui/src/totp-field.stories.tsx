import { TotpField } from "./totp-field";
import preview from "../.storybook/preview";
import { textInput } from "./story-fixture";

const meta = preview.meta({ args: { code: textInput() }, component: TotpField });

export const Empty = meta.story();

export const Filled = meta.story({ args: { code: textInput("123456") } });
