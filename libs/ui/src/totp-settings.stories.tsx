import { session, settingsContext } from "./story-fixture";
import { TotpSettings } from "./totp-settings";
import preview from "../.storybook/preview";

const meta = preview.meta({ args: { context: settingsContext() }, component: TotpSettings });

export const NotEnrolled = meta.story();

export const Enrolled = meta.story({
  args: { context: settingsContext({ session: session({ twoFactorEnabled: true }) }) },
});
