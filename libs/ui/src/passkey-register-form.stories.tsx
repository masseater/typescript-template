import { session, settingsContext } from "./story-fixture";
import { PasskeyRegisterForm } from "./passkey-register-form";
import { fn } from "storybook/test";
import preview from "../.storybook/preview";

const meta = preview.meta({
  args: { context: settingsContext(), onRegistered: fn() },
  component: PasskeyRegisterForm,
});

const Default = meta.story();

const RecoveringAdmin = meta.story({
  args: {
    context: settingsContext({
      recovery: "1",
      session: session({ role: "admin" }, false),
    }),
  },
});

export { Default, RecoveringAdmin };
