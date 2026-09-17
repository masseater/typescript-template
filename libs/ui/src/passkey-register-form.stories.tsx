import { session, settingsContext } from "./story-fixture";
import { PasskeyRegisterForm } from "./passkey-register-form";
import { fn } from "storybook/test";
import preview from "../.storybook/preview";

const meta = preview.meta({
  args: { context: settingsContext(), onRegistered: fn() },
  component: PasskeyRegisterForm,
});

export const Default = meta.story();

export const RecoveringAdmin = meta.story({
  args: {
    context: settingsContext({
      recovery: "1",
      session: session({ role: "admin" }, false),
    }),
  },
});
