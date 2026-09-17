import { TotpField } from "./totp-field";
import preview from "../.storybook/preview";
import { textInput } from "./story-fixture";

const meta = preview.meta({ args: { code: textInput() }, component: TotpField });

const Empty = meta.story();

const Filled = meta.story({ args: { code: textInput("123456") } });

export { Empty, Filled };
