import { session, settingsContext } from "./story-fixture";
import { TotpPasswordForm } from "./totp-password-form";
import { fn } from "storybook/test";
import preview from "../.storybook/preview";

const meta = preview.meta({
  args: { context: settingsContext(), enrolling: false, onEnroll: fn() },
  component: TotpPasswordForm,
});

const Enroll = meta.story();

const Disable = meta.story({
  args: { context: settingsContext({ session: session({ twoFactorEnabled: true }) }) },
});

const AdminLocked = meta.story({
  args: {
    context: settingsContext({
      session: session({ role: "admin", twoFactorEnabled: true }),
    }),
  },
});

const Enrolling = meta.story({ args: { enrolling: true } });

export { AdminLocked, Disable, Enroll, Enrolling };
