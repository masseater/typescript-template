import { idleAction, pendingAction } from "./story-fixture";
import { PasskeyLoginButton } from "./passkey-login-button";
import { fn } from "storybook/test";
import preview from "../.storybook/preview";

const meta = preview.meta({
  args: { action: idleAction(), onAuthenticated: fn() },
  component: PasskeyLoginButton,
});

const Default = meta.story();

const Pending = meta.story({ args: { action: pendingAction() } });

export { Default, Pending };
