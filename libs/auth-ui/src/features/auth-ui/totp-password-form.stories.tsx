import preview from "../../../storybook/preview";
import { settingsContext } from "./settings-context-fixture";
import { TotpPasswordForm } from "./totp-password-form";

const meta = preview.meta({
  args: {
    context: settingsContext(),
    enrolling: false,
    onEnroll: () => undefined,
  },
  component: TotpPasswordForm,
});

export const Enroll = meta.story();

export const Disable = meta.story({
  args: {
    context: settingsContext({ user: { twoFactorEnabled: true } }),
  },
});

export const AdminLocked = meta.story({
  args: {
    context: settingsContext({ user: { role: "admin", twoFactorEnabled: true } }),
  },
});

export const Enrolling = meta.story({ args: { enrolling: true } });
