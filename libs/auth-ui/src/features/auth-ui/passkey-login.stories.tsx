import preview from "../storybook/preview";
import { PasskeyLogin } from "./passkey-login";

const meta = preview.meta({
  args: {
    action: { blocked: false, error: undefined, pending: false, run: () => undefined },
    onAuthenticated: () => undefined,
  },
  component: PasskeyLogin,
});

export const Default = meta.story();

export const Pending = meta.story({
  args: { action: { blocked: true, error: undefined, pending: true, run: () => undefined } },
});
