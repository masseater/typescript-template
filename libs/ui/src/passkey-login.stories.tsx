import { noop } from "es-toolkit";

import preview from "../.storybook/preview";
import { PasskeyLogin } from "./passkey-login";

const meta = preview.meta({
  args: {
    action: { blocked: false, error: undefined, pending: false, run: noop },
    onAuthenticated: noop,
  },
  component: PasskeyLogin,
});

export const Default = meta.story();

export const Pending = meta.story({
  args: { action: { blocked: true, error: undefined, pending: true, run: noop } },
});
