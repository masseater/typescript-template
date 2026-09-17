import { session, settingsContext } from "./story-fixture";
import { TotpSettings } from "./totp-settings";
import preview from "../.storybook/preview";

const meta = preview.meta({ args: { context: settingsContext() }, component: TotpSettings });

const NotEnrolled = meta.story();

const Enrolled = meta.story({
  args: { context: settingsContext({ session: session({ twoFactorEnabled: true }) }) },
});

export { Enrolled, NotEnrolled };
