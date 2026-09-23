import preview from "../../../storybook/preview";
import { settingsContext } from "./settings-context-fixture";
import { TotpSettings } from "./totp-settings";

const meta = preview.meta({
  args: {
    context: settingsContext(),
  },
  component: TotpSettings,
});

export const NotEnrolled = meta.story();

export const Enrolled = meta.story({
  args: {
    context: settingsContext({ user: { twoFactorEnabled: true } }),
  },
});
